import {
    MdAudiotrack, MdDescription, MdFolderZip, MdImage, MdInsertDriveFile, MdMovie, MdPictureAsPdf, MdSlideshow, MdTableChart,
} from 'react-icons/md';
import { downloadFile } from 'services/crm';

const FILE_TYPES = [
    { extensions: ['pdf'], icon: MdPictureAsPdf, color: 'red.500', label: 'PDF' },
    { extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'svg', 'tif', 'tiff'], icon: MdImage, color: 'purple.500', label: 'Hình ảnh' },
    { extensions: ['doc', 'docx', 'odt', 'rtf', 'txt'], icon: MdDescription, color: 'blue.500', label: 'Văn bản' },
    { extensions: ['xls', 'xlsx', 'ods', 'csv'], icon: MdTableChart, color: 'green.500', label: 'Bảng tính' },
    { extensions: ['ppt', 'pptx', 'odp'], icon: MdSlideshow, color: 'orange.500', label: 'Trình chiếu' },
    { extensions: ['zip', 'rar', '7z', 'tar', 'gz'], icon: MdFolderZip, color: 'yellow.600', label: 'Tệp nén' },
    { extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'], icon: MdMovie, color: 'pink.500', label: 'Video' },
    { extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'], icon: MdAudiotrack, color: 'teal.500', label: 'Âm thanh' },
];

const OTHER_TYPE = { icon: MdInsertDriveFile, color: 'gray.500', label: 'Tệp' };

// Extension of a stored document: the file on the server first (the name shown
// may be a custom name without extension)
export const fileExtension = (file) => {
    const sources = [file?.path, file?.img, file?.fileName, file?.name];
    for (let i = 0; i < sources.length; i += 1) {
        const match = typeof sources[i] === 'string' && /\.([a-z0-9]{1,5})$/i.exec(sources[i].split(/[?#]/)[0]);
        if (match) return match[1].toLowerCase();
    }
    return '';
};

export const fileType = (file) => FILE_TYPES.find((type) => type.extensions.includes(fileExtension(file))) || OTHER_TYPE;

// Name of the downloaded file: the name shown, with the extension of the stored file
export const downloadName = (file) => {
    const name = String(file?.fileName || 'tai-lieu').trim().replace(/[\\/:*?"<>|]+/g, '-');
    const extension = fileExtension(file);
    return extension && !name.toLowerCase().endsWith(`.${extension}`) ? `${name}.${extension}` : name;
};

// Downloads need the session token (see services/crm downloadFile); errors are
// thrown with a Vietnamese message
export const downloadDocument = (file) => downloadFile(`api/document/download/${file._id}`, downloadName(file));
