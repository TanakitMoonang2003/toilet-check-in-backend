const multer = require('multer')
const fs = require('fs')
const path = require('path')

const uploadFolder = path.join(__dirname, '../../public/images')
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, {recursive: true})
}
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '--' + file.originalname);
    }
})

const uploadImageMulti = multer({
    storage: fileStorage,
}).array('images');  

const uploadImageSingle = multer({
    storage: fileStorage,
}).single('image'); 

module.exports = { uploadImageMulti, uploadImageSingle };