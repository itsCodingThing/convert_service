import axios from "axios";
import { createReadStream, promises as fsPromise } from "fs";

import { getFilePathName } from "../utils/utils.js";
import { uploadFileStream } from "../services/s3.service.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/serverResponse.js";
import { compressPdfWithGS, pdf2img } from "../services/pdf.service.js";

export default async (fastify) => {
    /**
     * @route   POST /api/pdf/extract-pages
     * @desc    extract pages from url
     */
    fastify.post("/pdf/extract-pages", async (req, res) => {
        const { link } = req.body;

        // download pdf from url as arraybuffer
        const response = await axios({ method: "GET", url: link, responseType: "arraybuffer" });
        const tempPaths = await pdf2img(response.data);

        // upload extract pages to s3
        const pages = await Promise.all(
            tempPaths.map(async (url) => {
                const result = await uploadFileStream({
                    type: "image",
                    contentType: "image/jpeg",
                    payload: createReadStream(url),
                });

                return result.url;
            })
        );

        // delete created file
        await Promise.all(tempPaths.map(async (url) => await fsPromise.unlink(url)));

        return sendSuccessResponse({ msg: "Success", response: res, data: pages });
    });

    /**
     * @route   POST /api/pdf/compress
     * @desc    pdf compression
     */
    fastify.post("/pdf/compress", async (req, res) => {
        const files = await req.saveRequestFiles();

        //generate random file name with absolute path
        const tempRandomFilename = getFilePathName("pdf");

        try {
            await compressPdfWithGS({ input: files[0].filepath, output: tempRandomFilename.filename });
        } catch (error) {
            console.log(error);

            return sendErrorResponse({ msg: "error", response: res });
        }

        // upload extract pages to s3
        const result = await uploadFileStream({
            type: "pdf",
            contentType: "application/pdf",
            payload: createReadStream(tempRandomFilename.filename),
        });

        // delete created file
        await fsPromise.unlink(tempRandomFilename.filename);

        return sendSuccessResponse({ msg: "Success", response: res, data: result.url });
    });
};
