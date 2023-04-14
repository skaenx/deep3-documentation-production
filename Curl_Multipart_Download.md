## Resume the download progress when the download failed

### 1) About Content-Range header

https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests

### 2) Apply Range header

Split a file to multipart for failed-over when downloading

#### Step 1) Get file size

```sh
curl -r 0-0 <PresignedUrl>
> Host: test-aws-multipart.s3.ap-northeast-1.amazonaws.com
> Range: bytes=0-0
> User-Agent: curl/7.79.1
> Accept: */*
>
* Mark bundle as not supporting multiuse
< HTTP/1.1 206 Partial Content
< x-amz-id-2: zUMH82+N40PjyN2zaXzBqANeDQDuUaFdMVnYjPn1wOgmFqH7XxZZU2KJMmmdP15xfB9qkWOnM6E=
< x-amz-request-id: 9QH9QYQDTYJ7ACGP
< Date: Wed, 01 Feb 2023 00:55:44 GMT
< Last-Modified: Tue, 31 Jan 2023 09:41:16 GMT
< ETag: "5742857850a2c5f41e1eb745ab2979a9"
< Content-Disposition: inline
< Accept-Ranges: bytes
< Content-Range: bytes 0-0/7902061
< Content-Type: binary/octet-stream
< Server: AmazonS3
< Content-Length: 1
<
* Connection #0 to host test-aws-multipart.s3.ap-northeast-1.amazonaws.com left intact
L%
```

#### Step 2) Download each part by range

```sh
curl -r 0-1024 <Presigned Url> -o filename.laz.part1
curl -r 1024- <Presigned Url> -o filename.laz.part2

> Host: test-aws-multipart.s3.ap-northeast-1.amazonaws.com
> Range: bytes=1025-
> User-Agent: curl/7.79.1
> Accept: */*
>
* Mark bundle as not supporting multiuse
< HTTP/1.1 206 Partial Content
< x-amz-id-2: BY4jH0OpaKKoY5Nw/WrpdpS8AXhghk8UaWHwPLxRyZqkufXrIUGECA1qCvtlnfxoada1xh4CxZg=
< x-amz-request-id: FB706T4FQ8ZDDZHP
< Date: Wed, 01 Feb 2023 01:03:34 GMT
< Last-Modified: Tue, 31 Jan 2023 09:41:16 GMT
< ETag: "5742857850a2c5f41e1eb745ab2979a9"
< Content-Disposition: inline
< Accept-Ranges: bytes
< Content-Range: bytes 1025-7902060/7902061
< Content-Type: binary/octet-stream
< Server: AmazonS3
< Content-Length: 7901036
```
