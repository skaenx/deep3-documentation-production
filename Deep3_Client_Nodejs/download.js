const version = parseInt(process.versions.node);
if (version < 16 || version > 18) {
  console.error("Error: Only support nodejs version >=16.x <=18.x");
  process.exit();
}

const args = process.argv;

if (args.length < 3) {
  console.error("Error: Missing args");
  process.exit();
}

// Get signedURL from args
const url = args[2];
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ProgressBar = require("progress");
const util = require("util");
const finished = util.promisify(require("stream").finished);

// Set the number of chunks to download
const numChunks = 4;
const maxRetries = 3;
const filenameWithParams = url.substring(url.lastIndexOf("/") + 1);
const outputFileName = decodeURI(filenameWithParams.split("?")[0]);
console.log(outputFileName);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadFile() {
  const { headers } = await axios({
    url,
    method: "GET",
    responseType: "stream",
    // headers: {
    //   Range: `bytes=${fileSize}-`,
    // },
  });
  const totalLength = headers["content-length"];

  // Calculate the chunk size
  const chunkSize = Math.ceil(totalLength / numChunks);

  console.log(`Starting download (${numChunks} chunks)`);
  const progressBar = new ProgressBar(`-> Downloading [:bar] :percent :etas`, {
    width: 40,
    complete: "=",
    incomplete: " ",
    renderThrottle: 1,
    total: parseInt(totalLength),
  });

  // Download each chunk in parallel with retries
  const downloadPromises = [];
  const chunkFiles = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = (i + 1) * chunkSize - 1;
    const chunkFilename = `chunk-${i + 1}.dat`;

    downloadPromises.push(
      new Promise(async (resolve, reject) => {
        let retryCount = 0;
        let downloaded = false;
        while (retryCount < maxRetries && !downloaded) {
          try {
            console.log(`Downloading ${chunkFilename}...`);
            const response = await axios({
              url,
              method: "GET",
              responseType: "stream",
              headers: {
                Range: `bytes=${start}-${end}`,
              },
            });
            const writer = fs.createWriteStream(
              path.resolve(__dirname, "downloads", chunkFilename),
              {
                flags: "a",
              }
            );
            // Set up an error handler for the write stream
            writer.on("error", (error) => {
              console.error(
                `Error writing chunk ${chunkFilename}: ${error.message}`
              );
              throw error;
            });
            // Pipe data
            response.data.pipe(writer);
            response.data.on("end", () => {
              writer.end();
              console.log(`\n${chunkFilename} downloaded successfully`);
              chunkFiles.push(
                path.resolve(__dirname, "downloads", chunkFilename)
              );
              downloaded = true;
              resolve();
            });
            response.data.on("data", (chunk) => {
              progressBar.tick(chunk.length);
            });
            response.data.on("error", (error) => {
              console.error(
                `Error writing chunk ${chunkFilename}: ${error.message}`
              );
              throw error;
            });
            // wait for finished
            await finished(writer);
          } catch (error) {
            console.error(
              `Error downloading chunk ${chunkFilename}: ${error.message}`
            );
            console.log(`Wait before retrying...`);
            await sleep(30000); // Wait before retrying
            console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);
            retryCount++;
          }
        }
        reject(new Error(`Max retries exceeded for chunk ${i}.`));
      })
    );
  }

  // Wait for all chunks to be downloaded
  try {
    await Promise.all(downloadPromises);
    console.log("\nDownload complete!");

    // Combine the chunks into a single file
    const chunks = chunkFiles
      .sort()
      .map((filename) => fs.readFileSync(filename));
    console.log("Combine the chunks...");
    await writeChunksToFile(outputFileName, chunks);
    console.log("Combine the chunks into a single file successfully!");

    // Delete the chunk files
    for (let i = 0; i < numChunks; i++) {
      fs.unlinkSync(chunkFiles[i]);
      console.log(`Deleted chunk file: ${chunkFiles[i]}`);
    }
  } catch (error) {
    console.error(`Error downloading file: ${error.message}`);
    return;
  }
}

async function writeChunksToFile(outputFileName, chunks) {
  const combineWriter = fs.createWriteStream(
    path.resolve(__dirname, "downloads", outputFileName)
  );

  const writeChunk = (chunkData) => {
    return new Promise((resolve, reject) => {
      if (combineWriter.write(chunkData)) {
        resolve();
      } else {
        combineWriter.once("drain", resolve);
      }
    });
  };

  for (let i = 0; i < chunks.length; i++) {
    const chunkData = chunks[i];
    await writeChunk(chunkData);
    console.log(`Done chunk ${i + 1} of ${chunks.length}`);
  }

  // Close the stream
  combineWriter.end();

  return new Promise((resolve, reject) => {
    combineWriter.on("finish", resolve);
    combineWriter.on("error", reject);
  });
}

downloadFile();
