const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucket = process.env.AWS_BUCKET;
const region = process.env.AWS_REGION;

function getClient() {
  return new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

const s3Provider = {
  type: "s3",

  async upload(buffer, cloudKey, mimeType) {
    const client = getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: cloudKey,
        Body: buffer,
        ContentType: mimeType || "application/octet-stream",
      })
    );
  },

  async download(cloudKey) {
    const client = getClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: cloudKey })
    );
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },

  async delete(cloudKey) {
    const client = getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: cloudKey })
    );
  },

  async copy(sourceKey, destKey) {
    const client = getClient();
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: destKey,
      })
    );
  },

  async exists(cloudKey) {
    const client = getClient();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: cloudKey })
      );
      return true;
    } catch (err) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  },

  getReadStream(cloudKey) {
    // Returns a promise-based async iterable; wrap for pipe compatibility
    const client = getClient();
    const { PassThrough } = require("stream");
    const passThrough = new PassThrough();
    client
      .send(new GetObjectCommand({ Bucket: bucket, Key: cloudKey }))
      .then((response) => {
        response.Body.pipe(passThrough);
      })
      .catch((err) => {
        passThrough.destroy(err);
      });
    return passThrough;
  },

  async getSignedUrl(cloudKey, ttlSeconds = 3600) {
    const client = getClient();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: cloudKey }),
      { expiresIn: ttlSeconds }
    );
    return url;
  },
};

module.exports = s3Provider;
