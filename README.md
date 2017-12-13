## Firebase image processor 🔥
 
Firebase cloud function to modify quality and size of an image in google cloud console.
 
Following parameters are excepted:
 
1. filename (required): filename of image to be modified, has to be available on gcs.
2. quality (optional): quality of final image in %.
3. scale (optional): size of image in %, will modify size without keeping the aspect ratio.
 
The final image will be stored on gcs in the same bucket as the original image and the signed file url will be returned.

So the flow is as follows:

1. you have uploaded an image to firebase storage/google cloud storage
2. you call https://cloud..function../createNewLowerQualityImage?filename=originalFilename&quality=..&scale=..
3. a new image (originalFilename_postfix) is created and stored alongside the original file
4. signed url to new image is returned as response