## How to upload file using API KEY

Copy your API-KEY from the order detail

### Step 1) Post create multipart

Call Post create multipart to init the uploadId & generate the presigned urls

```sh
curl -X 'POST' \
 'https://api.deepthree.ai/api/analysis/create-multipart-url' \
 -H 'accept: application/json' \
 -H 'x-deep3-api-key: YOUR-API-KEY' \
 -H 'Content-Type: application/json' \
 -d '{"fileName": "YOUR-FILENAME.laz", "numberOfParts": 1, "fileSize": 1024}' \
 -v
```

Example request

```sh
curl -X 'POST' \
 'https://api.deepthree.ai/api/analysis/create-multipart-url' \
 -H 'accept: application/json' \
 -H 'x-deep3-api-key: nbZgNoZ5Ns9sqdhIDOb4hhGZCvB29JICjmQ3F61I0MF1uORTW3' \
 -H 'Content-Type: application/json' \
 -d '{"fileName": "demo-3d-file.laz", "numberOfParts": 1, "fileSize": 1024}' \
 -v
```

Example response from API

```json
{
  "presignedUrls": [
    "https://test-aws-multipart.s3.ap-northeast-1.amazonaws.com/171d9153-1d42-4bbe-bf26-d7ad106c36e3/a6933423-0cb5-4b3d-8e8f-0be145be27a7/demo-3d-file.laz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA36DVPTPRVWHWOXPO%2F20230202%2Fap-northeast-1%2Fs3%2Faws4_request&X-Amz-Date=20230202T044838Z&X-Amz-Expires=900&X-Amz-Signature=352fd6ea59d2f2caff54d7a56c02d1e16a9c31fdaff3a767b274cc877ea36ce6&X-Amz-SignedHeaders=host&partNumber=1&uploadId=bRW.TO7vsb9SWU6jHCg.slcdlC8ePGkK_E0tzCBkcFo6wJ2txfjZqxfPtP0Yq52Cx8niu0Am3_PuErUZRi4TjIIJjJEYvxnaoPIfzuHKsrHcdGgUjBHFTvT9QvGsVmOo7MK9kFoez484lKWG5mb.Dw--"
  ],
  "uploadId": "bRW.TO7vsb9SWU6jHCg.slcdlC8ePGkK_E0tzCBkcFo6wJ2txfjZqxfPtP0Yq52Cx8niu0Am3_PuErUZRi4TjIIJjJEYvxnaoPIfzuHKsrHcdGgUjBHFTvT9QvGsVmOo7MK9kFoez484lKWG5mb.Dw--"
}
```

### Step 2) Put data to S3

```sh
curl --location --request PUT 'https://test-aws-multipart.s3.ap-northeast-1.amazonaws.com/171d9153-1d42-4bbe-bf26-d7ad106c36e3/a6933423-0cb5-4b3d-8e8f-0be145be27a7/demo-3d-file.laz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA36DVPTPRVWHWOXPO%2F20230202%2Fap-northeast-1%2Fs3%2Faws4_request&X-Amz-Date=20230202T044838Z&X-Amz-Expires=900&X-Amz-Signature=352fd6ea59d2f2caff54d7a56c02d1e16a9c31fdaff3a767b274cc877ea36ce6&X-Amz-SignedHeaders=host&partNumber=1&uploadId=bRW.TO7vsb9SWU6jHCg.slcdlC8ePGkK_E0tzCBkcFo6wJ2txfjZqxfPtP0Yq52Cx8niu0Am3_PuErUZRi4TjIIJjJEYvxnaoPIfzuHKsrHcdGgUjBHFTvT9QvGsVmOo7MK9kFoez484lKWG5mb.Dw--' \
--header 'Content-Type: binary/octet-stream' \
--data-binary '@/Users/cucongcan/Downloads/demo-3d-file.laz' -v
```

### Step3) Post complete

```sh
curl -X 'POST' \
 'https://api.deepthree.ai/api/analysis/complete-multipart' \
 -H 'accept: application/json' \
 -H 'Content-Type: application/json' \
 -H 'x-deep3-api-key: nbZgNoZ5Ns9sqdhIDOb4hhGZCvB29JICjmQ3F61I0MF1uORTW3' \
 --data-raw  '{"fileName": "demo-3d-file.laz", "uploadId": "YOUR-UPLOAD-ID-FROM-STEP1","etags": [{"ETag": "YOUR-ETAG-FROM-STEP2", "PartNumber": 1}]}' \
 -v
```
