import * as yup from 'yup';

// Upload of documents into a folder (a custom name is only used for a single file)
export const documentSchema = yup.object({
    folderName: yup.string().trim().required('Vui lòng nhập tên thư mục').max(100, 'Tên thư mục tối đa 100 ký tự'),
    filename: yup.string().trim().nullable().min(2, 'Tên tài liệu phải có ít nhất 2 ký tự').max(200, 'Tên tài liệu tối đa 200 ký tự'),
    files: yup.array().required('Vui lòng chọn ít nhất một tệp').min(1, 'Vui lòng chọn ít nhất một tệp'),
});
