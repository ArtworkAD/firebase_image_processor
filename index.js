const functions = require('firebase-functions');
const mkdirp = require('mkdirp-promise');
const gcs = require('@google-cloud/storage');
const admin = require('firebase-admin');
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * This cloud function requires at least 512MB of memory. By default a cloud function
 * is assigned with 256MB of memory by google cloud. Adjust the memory here:
 * https://console.cloud.google.com/functions
 */

/**
 * Init firebase admin.
 */
admin.initializeApp(functions.config().firebase);

/**
 * Init storage.
 */
const storage = gcs({ keyFilename: 'firebase-admin.json' });

/**
 * ## createNewLowerQualityImage Firebase cloud function
 *
 * This cloud function can modify the quality and size of an image. The image
 * has to be available on google cloud storage (gcs). Following parameters are excepted:
 *
 * 1. filename (required): filename of image to be modified, has to be available on gcs.
 * 2. quality (optional): quality of final image in %.
 * 3. scale (optional): size of image in %, will modify size without keeping the aspect ratio.
 *
 * The final image will be stored on gcs in the same bucket as the original image and the signed file url will be returned.
 */
exports.createNewLowerQualityImage = functions.https.onRequest((req, res) => {

    /**
     * Gcs filename.
     */
    const filename = req.query.filename;

    /**
     * Quality of image in %.
     */
    const quality = req.query.quality || 10;

    /**
     * Scale size of image in %.
     */
    const scale = req.query.scale || 100;

    /**
     * Will be appended to original filename.
     */
    const newFilePostfix = '_modified';

    /**
     * Gcs bucket name.
     */
    const bucketName = 'your_bucket';

    if (!filename) {
        return res.status(409).json({
            message: 'File parameter not specified',
            statusCode: 409
        });
    }

    /**
     * Original file.
     */
    const fileDir = path.dirname(filename);
    const fileName = path.basename(filename);

    /**
     * New file.
     */
    const newFilePath = path.normalize(path.join(fileDir, `${fileName}${newFilePostfix}`));

    /**
     * Original file is stored as tmp file for processing.
     */
    const tempLocalFile = path.join(os.tmpdir(), filename);
    const tempLocalDir = path.dirname(tempLocalFile);
    const tempLocalThumbFile = path.join(os.tmpdir(), newFilePath);

    /**
     * Bucket reference.
     */
    const bucket = storage.bucket(bucketName);

    /**
     * Original file in gcs.
     */
    const file = bucket.file(filename);

    /**
     * New file in gcs.
     */
    const newFile = bucket.file(newFilePath);

    /**
     * Construct imagemagick command.
     */
    let convert = [tempLocalFile, '-quality', quality, '-scale', `${scale}%`, '-dither', 'none', '-posterize', '100', '-strip', tempLocalThumbFile];

    /**
     * 1. Create local tmp dir
     * 2. Download original file as tmp file into tmp dir
     * 3. Process with imagemagick
     * 4. Upload new file
     * 5. Remove tmp folder and file, create signed url
     * 6. Return signed url
     */
    return mkdirp(tempLocalDir)
        .then(() => file.download({ destination: tempLocalFile }))
        .then(() => spawn('convert', convert, { capture: ['stdout', 'stderr'] }))
        .then(() => bucket.upload(tempLocalThumbFile, {
            destination: newFilePath
        }))
        .then(() => {
            fs.unlinkSync(tempLocalFile);
            fs.unlinkSync(tempLocalThumbFile);
            const config = {
                action: 'read',
                expires: '03-01-2500'
            };
            return Promise.all([
                newFile.getSignedUrl(config),
                file.getSignedUrl(config)
            ]);
        })
        .then(results => {
            return res.status(200).send(results[0][0]);
        });
});