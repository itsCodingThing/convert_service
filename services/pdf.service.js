import fs from "fs";
import GM from "gm";
import stream from "stream";
import { execa } from "execa";
import { PDFDocument } from "pdf-lib";

import { getFilePathName, getFilePath } from "../utils/utils.js";

// import { type } from "os";
// import { sep } from "path";
// import { env } from "process";
// import { readFileSync } from "fs";
// import { execSync } from "child_process";

// export function compressPdfWithLibra(filename = "", filepath = "") {
//     let command = "";
//     const args = `--headless --convert-to pdf:writer_pdf_Export ${filepath} --outdir output`;
//     const name = filepath.split(sep).pop();

//     if (type() === "Windows_NT") {
//         command = `"C:${sep}Program Files${sep}LibreOffice${sep}program${sep}soffice.exe" ${args}`;
//     } else {
//         command = `soffice ${args}`;
//     }

//     execSync(command, { shell: env.ComSpec, windowsHide: true });
//     return readFileSync(filepath);
// }

const gm = GM;

export const paginate = (arr, size) => {
    return arr.reduce((acc, val, i) => {
        let idx = Math.floor(i / size);
        let page = acc[idx] || (acc[idx] = []);
        page.push(val);

        return acc;
    }, []);
};

export async function splitPdf(bytes) {
    const pdfDoc = await PDFDocument.load(bytes);

    const numberOfPages = pdfDoc.getPages().length;
    let pages = Array.from({ length: numberOfPages }).map((_, i) => i);

    return await Promise.all(
        pages.map(async (i) => {
            // Create a new "sub" document
            const subDocument = await PDFDocument.create();
            // copy the page at current index
            const [copiedPage] = await subDocument.copyPages(pdfDoc, [i]);
            subDocument.addPage(copiedPage);
            const pdfBytes = await subDocument.save();

            return { pdfBytes, i };
        })
    );
}

export const convert = (buff, index, file) => {
    return new Promise((resolve, reject) => {
        console.log(`gm process started: page ${index}.`);

        let tempPathFilename = getFilePath({ type: "image", id: `${file}_${index}` });

        gm(buff)
            .selectFrame(index)
            .density(720, 1280)
            .quality(30)
            .setFormat("jpeg")

            .write(tempPathFilename, function (err) {
                if (err) return reject(err);
                console.log("Created an image from a Buffer!");

                resolve(tempPathFilename);
            });
    });
};

export const convertWithPageCount = async (gmState, pages, filename) => {
    const promisifyGM = async (page, fname) => {
        console.log(`gm process started: page ${page}.`);

        const writeStream = fs.createWriteStream(fname);

        await stream.promises
            .pipeline(
                // gmState.selectFrame(page).resize(1000, 1280).density(500, 640).quality(80).setFormat("jpeg").stream(),
                gmState.selectFrame(page).resize(720, 1280).density(300, 300).quality(80).setFormat("jpeg").stream(),
                writeStream
            )
            .catch((e) => console.log(e));

        console.log("Created an image successfully");
        return fname;
    };

    const pathList = [];

    for (const page of pages) {
        let tempPathFilename = getFilePath({ type: "image", id: `${filename}_${page}` });
        const p = await promisifyGM(page, tempPathFilename);

        pathList.push(p);
    }

    // const list = await Promise.all(
    //     pages.map(async (page) => {
    //         let tempPathFilename = getFilePath({ type: "image", id: `${filename}_${page}` });
    //         const p = await promisifyGM(page, tempPathFilename);
    //         return p;
    //     })
    // );

    return pathList;
};

export async function pdf2img(buff) {
    const pdfBuffer = buff;
    const gmState = gm(buff);

    const pdoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdoc.getPageCount();
    const pages = Array.from({ length: pageCount }).map((_, i) => i);

    const file = getFilePathName("image");

    // if (pageCount > 10) {
    //     const paginatedArr = paginate(pages, 10);
    //     for (const p of paginatedArr) {
    //         const list = await convertWithPageCount(gmState, p, file.fileId);
    //         result.push(list);
    //     }
    // } else {
    //     // const result = await Promise.all(pages.map((page) => convert(pdfStream, page, file.fileId)));
    //     // // const result = await convertWithPageCount(pdf, pages, file.fileId);
    // }

    const list = await convertWithPageCount(gmState, pages, file.fileId);

    return list;
}

export async function compressPdfWithGS(opt) {
    const command = opt.command || "gs";

    const {
        input = "-",
        output = "-",
        compatibilityLevel = 1.5,
        compressFonts = true,
        embedAllFonts = true,
        subsetFonts = true,
        dpi = 300,
        quiet = true,
        preset = "screen",
        colorConversionStrategy = "RGB",
    } = opt;

    const args = [
        "-sDEVICE=pdfwrite",
        `-dPDFSETTINGS=/${preset}`,
        "-dNOPAUSE",
        quiet ? "-dQUIET" : "",
        "-dBATCH",
        `-dCompatibilityLevel=${String(compatibilityLevel)}`,
        // font settings
        `-dSubsetFonts=${subsetFonts}`,
        `-dCompressFonts=${compressFonts}`,
        `-dEmbedAllFonts=${embedAllFonts}`,
        // color format
        "-sProcessColorModel=DeviceRGB",
        `-sColorConversionStrategy=${colorConversionStrategy}`,
        `-sColorConversionStrategyForImages=${colorConversionStrategy}`,
        "-dConvertCMYKImagesToRGB=true",
        // image resampling
        "-dDetectDuplicateImages=true",
        "-dColorImageDownsampleType=/Bicubic",
        `-dColorImageResolution=${dpi}`,
        "-dGrayImageDownsampleType=/Bicubic",
        `-dGrayImageResolution=${dpi}`,
        "-dMonoImageDownsampleType=/Bicubic",
        `-dMonoImageResolution=${dpi}`,
        "-dDownsampleColorImages=true",
        // other overrides
        "-dDoThumbnails=false",
        "-dCreateJobTicket=false",
        "-dPreserveEPSInfo=false",
        "-dPreserveOPIComments=false",
        "-dPreserveOverprintSettings=false",
        "-dUCRandBGInfo=/Remove",
        `-sOutputFile=${output}`,
        input,
    ].filter(Boolean);

    return execa(command, args, {
        stdio: "inherit",
    });
}
