import { v4 as uuid } from "uuid";
import { Upload } from "@aws-sdk/lib-storage";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { config } from "../utils/utils.js";

const REGION = config.aws.REGION;
const BUCKET = config.aws.BUCKET_FILE;
const ACCESS_KEY_ID = config.aws.ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = config.aws.SECRET_ACCESS_KEY;

const s3Client = new S3Client({
    region: REGION,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

export async function uploadFileStream({ type, payload, filename = `${Date.now()}_${uuid()}`, contentType }) {
    const key = `${type}/${filename}`;

    const streamUpload = new Upload({
        client: s3Client,
        params: {
            Bucket: BUCKET,
            Key: key,
            Body: payload,
            ContentType: contentType,
            ContentDisposition: "download",
        },
    });

    // const results = await s3Client.send(
    //     new PutObjectCommand({
    //         Bucket: BUCKET,
    //         Key: key,
    //         Body: payload,
    //         ContentType: contentType,
    //         ContentDisposition: "download",
    //     })
    // );

    const results = await streamUpload.done();

    return { results, url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}` };
}

export async function deleteS3File({ type, filename }) {
    const key = `${type}/${filename}`;
    const results = await s3Client.send(
        new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    );

    return results;
}
