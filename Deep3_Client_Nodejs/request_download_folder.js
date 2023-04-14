const baseUrl = "https://api.deepthree.ai";

const args = process.argv;
const apiKey = args[2];
const folderId = args[3];

const axios = require("axios");

async function main() {
  const body = {};
  try {
    const response = await axios.post(
      baseUrl + `/api/folders/${folderId}/download`,
      body,
      {
        headers: {
          "x-deep3-api-key": apiKey,
        },
      }
    );
    console.log("Request download folder success!");
  } catch (error) {
    throw error;
  }
}

main();
//  node request_download_folder.js "apiKey" "folderId"
