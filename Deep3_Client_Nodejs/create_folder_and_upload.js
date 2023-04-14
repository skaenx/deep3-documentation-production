const baseUrl = "https://api.deepthree.ai";

const version = parseInt(process.versions.node);
if (version < 16 || version > 18) {
  console.log("Error: Only support nodejs version >=16.x <=18.x");
  process.exit();
}

// args[2]: apiKey, args[3]: folderPath
// args[4], args[5]...: filenames - only upload specific file in folder
const args = process.argv;
if (args.length < 4) {
  console.log("Error: Missing args");
  process.exit();
}
const apiKey = args[2];
const folderPath = args[3];
const folderName = folderPath.split("/").pop();

const axios = require("axios");
const fs = require("fs");

const maxRetries = 3;
let lasFileLimitSize = 5368709120; // 5GB
let lazFileLimitSize = 3221225472; // 3GB
let dataLimit = null; // unlimited
let dataSize = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callApiWithRetry(apiKey, fileName, folderId) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const maxPartSize = 100 * 1024 * 1024; // 100MB
      const filePath = `${folderPath}/${fileName}`;
      const fileSize = fs.statSync(filePath).size;
      const numberOfParts = Math.ceil(fileSize / maxPartSize);
      const parts = [];

      let presignedUrls = null;
      let uploadId = null;
      try {
        const response = await axios.post(
          baseUrl + "/api/analysis/create-multipart-url",
          {
            fileName: fileName,
            numberOfParts: numberOfParts,
            folderId: folderId,
          },
          {
            headers: {
              "x-deep3-api-key": apiKey,
            },
          }
        );
        presignedUrls = response.data.presignedUrls;
        uploadId = response.data.uploadId;
      } catch (error) {
        if (error.response && error.response.status === 400) {
          // if bad request stop retry
          retries = maxRetries;
          console.log(`Error: ${error.response.data.message}`);
        }
        throw error;
      }

      for (let i = 0; i < numberOfParts; i++) {
        const start = i * maxPartSize;
        const end = Math.min(start + maxPartSize, fileSize);

        const part = {
          data: fs.createReadStream(filePath, { start, end }),
          partNumber: i + 1,
          size: end - start,
        };

        parts.push(part);
      }

      const etags = [];
      for (let i = 0; i < numberOfParts; i++) {
        let partUploaded = false;
        let retryCount = 0;
        const presignedUrl = presignedUrls[i];
        const part = parts[i];

        while (!partUploaded && retryCount < maxRetries) {
          try {
            console.log(`Uploading ${fileName} - Part ${i + 1}...`);
            const response = await axios.put(presignedUrl, part.data, {
              headers: {
                "Content-Length": part.size,
                "Content-Type": "application/octet-stream",
              },
            });

            const etag = response.headers.etag;
            etags.push({ ETag: etag, PartNumber: part.partNumber });
            console.log(
              `File ${fileName} - Part ${part.partNumber} uploaded successfully with etag: ${etag}`
            );

            partUploaded = true;
          } catch (err) {
            console.log(`Failed to upload part ${i + 1}: ${err}`);
            retryCount++;
            console.log(`Wait 30s before retrying...`);
            await sleep(30000); // Wait before retrying
          }
        }

        if (!partUploaded) {
          console.log(`Reached max retries (${maxRetries}) for part ${i + 1}!`);
          throw new Error(
            `Reached max retries (${maxRetries}) for part ${i + 1}!`
          );
        }
      }

      const bodyCompleteUpload = {
        etags: etags,
        uploadId: uploadId,
      };

      // post upload complete
      const responseComplete = await axios.post(
        baseUrl + "/api/analysis/complete-multipart",
        bodyCompleteUpload,
        {
          headers: {
            "x-deep3-api-key": apiKey,
          },
        }
      );
      console.log(`Post complete-multipart-upload: ${fileName}!`);
      return;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        throw error;
      }
      console.log(`Error: ${error.message}`);
      retries++;
      console.log(`Wait 30s before retrying...`);
      await sleep(30000); // Wait before retrying
    }
  }
  console.log(`${fileName} - reached max retries (${maxRetries})!`);
  throw new Error(`Reached max retries (${maxRetries})!`);
}

async function main(folder) {
  if (!fs.existsSync(folder)) {
    console.log("Error: Directory does not exist!");
    process.exit();
  }

  let files = [];
  if (args.length > 4) {
    // If args[4] exists, only upload that file
    for (let i = 4; i < args.length; i++) {
      const file = args[i];
      if (file && fs.existsSync(`${folderPath}/${file}`)) {
        files.push(file);
      } else {
        console.log(`File ${file} does not exist`);
      }
    }
  } else {
    // upload all file in folder
    files = fs.readdirSync(folder);
  }

  // Get order information
  await getOrderInfo();

  // check files is valid or not
  let numberOfFiles = 0;
  const filesGoingToUpload = [];
  for (let i = 0; i < files.length; i++) {
    const fileExt = files[i].split(".").pop();
    const filePath = `${folderPath}/${files[i]}`;
    const fileSize = fs.statSync(filePath).size;
    if ("las" === fileExt || "laz" === fileExt || "zip" === fileExt) {
      numberOfFiles++;
      if (
        fileExt === "las" &&
        lasFileLimitSize != null &&
        fileSize >= lasFileLimitSize
      ) {
        numberOfFiles--;
        console.log(
          `Skipped file "${files[i]}" because reached las file's size limitation`
        );
        continue;
      }

      if (
        fileExt === "laz" &&
        lazFileLimitSize !== null &&
        fileSize >= lazFileLimitSize
      ) {
        numberOfFiles--;
        console.log(
          `Skipped file "${files[i]}" because reached laz file's size limitation`
        );
        continue;
      }

      if (dataLimit !== null && fileSize + dataSize >= dataLimit) {
        numberOfFiles--;
        console.log(
          `Skipped file "${files[i]}" because reached order's size limitation`
        );
        continue;
      }
      filesGoingToUpload.push(files[i]);
    } else {
      console.log(
        `Skipped "${files[i]}" because the file extension is not supported. Only support las, laz and zip`
      );
    }
  }
  if (numberOfFiles === 0) {
    console.log("There is no valid file to upload.");
    process.exit(1);
  }

  // Create folder
  let folderId = await createFolder();
  let successCount = 0;
  let errorCount = 0;
  let ongoingUploads = 0;

  for (let i = 0; i < filesGoingToUpload.length; i++) {
    while (ongoingUploads >= 4) {
      await sleep(10000); // Wait before checking again
    }

    ongoingUploads++;
    callApiWithRetry(apiKey, filesGoingToUpload[i], folderId)
      .then(() => {
        successCount++;
        console.log(`Upload success  ${successCount}/${numberOfFiles}`);
        console.log(`Starting analysis process... ${filesGoingToUpload[i]}`);
        return;
      })
      .catch((error) => {
        console.log(
          `Error while upload file ${filesGoingToUpload[i]}: ${error.message}`
        );
        errorCount++;
        console.log(
          `Upload failed ${errorCount}/${numberOfFiles}:  ${filesGoingToUpload[i]}`
        );
      })
      .finally(() => {
        ongoingUploads--;
      });
  }
}

async function getOrderInfo() {
  try {
    const orderRes = await axios.get(baseUrl + "/api/order", {
      headers: {
        "x-deep3-api-key": apiKey,
      },
    });
    console.log("Get oder info done!");
    console.log(orderRes.data);

    dataLimit = orderRes.data.dataLimit;
    dataSize = orderRes.data.dataSize;
    lasFileLimitSize = orderRes.data.lasFileLimitSize;
    lazFileLimitSize = orderRes.data.lazFileLimitSize;
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log(
        "Forbidden response from API. Maybe the reason is wrong API Key"
      );
    }
    console.log(`Get order info error: ${error}`);
    process.exit(1);
  }
}

async function createFolder() {
  try {
    const folderResponse = await axios.post(
      baseUrl + "/api/folders",
      {
        folderName: folderName,
      },
      {
        headers: {
          "x-deep3-api-key": apiKey,
        },
      }
    );
    console.log(`Create folder done! FolderId: ${folderResponse.data.id}`);
    return folderResponse.data.id;
  } catch (error) {
    console.log(`Call API create-folder error: ${error.message}}`);
    process.exit(1);
  }
}

main(folderPath);
//  node create_folder_and_upload.js.js "apiKey" "folderPath"
