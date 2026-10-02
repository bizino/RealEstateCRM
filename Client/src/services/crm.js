import axios from 'axios';
import { constant } from 'constant';
import { deleteApi, deleteManyApi, getApi, postApi, putApi } from './api';

// Messages of the API shown to users, in Vietnamese
const MESSAGES = {
    'Authentication failed, invalid username': 'Email đăng nhập không tồn tại',
    'Authentication failed,password does not match': 'Mật khẩu không đúng',
    'Username and password are required': 'Vui lòng nhập email và mật khẩu',
    'Current password is incorrect': 'Mật khẩu hiện tại không đúng',
    'The new password must have at least 6 characters': 'Mật khẩu mới phải có ít nhất 6 ký tự',
    'user already exist please try another email': 'Email này đã được dùng cho tài khoản khác',
    'User already exist please try another email': 'Email này đã được dùng cho tài khoản khác',
    'Admin already exist please try another email': 'Email này đã được dùng cho tài khoản khác',
    'admin can not delete': 'Không thể xóa tài khoản quản trị',
    'Access denied. Admin only.': 'Chỉ quản trị viên được thực hiện thao tác này',
    'Access denied.': 'Bạn không có quyền thực hiện thao tác này',
    'Invalid id or value': 'Dữ liệu không hợp lệ',
    'Invalid JSON body': 'Dữ liệu không hợp lệ',
    'No files uploaded.': 'Chưa chọn tệp',
};

const BY_STATUS = {
    400: 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại',
    403: 'Bạn không có quyền thực hiện thao tác này',
    404: 'Không tìm thấy dữ liệu (có thể đã bị xóa)',
    409: 'Dữ liệu bị trùng',
    413: 'Tệp quá lớn',
    500: 'Lỗi hệ thống, vui lòng thử lại sau',
};

// Vietnamese message of a failed call (axios error returned by services/api)
export const errorMessage = (error, fallback = 'Có lỗi xảy ra, vui lòng thử lại') => {
    const response = error?.response;
    if (!response) return error?.message && !error?.isAxiosError ? error.message : 'Không kết nối được máy chủ, vui lòng kiểm tra mạng';
    const message = response.data?.message || response.data?.error;
    if (typeof message === 'string' && message) {
        if (MESSAGES[message]) return MESSAGES[message];
        // Messages of the new endpoints are already in Vietnamese
        if (/[À-ỹ]/.test(message)) return message;
    }
    return BY_STATUS[response.status] || fallback;
};

export class ApiError extends Error {
    constructor(error) {
        super(errorMessage(error));
        this.status = error?.response?.status;
        this.data = error?.response?.data;
    }
}

// The helpers of services/api return the error instead of throwing it: these
// ones return the data of a successful call and throw an ApiError otherwise
const unwrap = (response) => {
    if (response && response.status >= 200 && response.status < 300) return response.data;
    throw new ApiError(response);
};

export const apiGet = async (path) => unwrap(await getApi(path));
export const apiPost = async (path, data) => unwrap(await postApi(path, data));
export const apiPut = async (path, data) => unwrap(await putApi(path, data));
export const apiDelete = async (path) => unwrap(await deleteApi(path, ''));
export const apiDeleteMany = async (path, ids) => unwrap(await deleteManyApi(path, ids));

// Downloads a file served by an authenticated endpoint (documents of customers,
// legal papers of properties): a plain link would not send the session token
export const downloadFile = async (path, fileName) => {
    let response;
    try {
        response = await axios.get(constant.baseUrl + path, {
            responseType: 'blob',
            headers: { Authorization: localStorage.getItem('token') || sessionStorage.getItem('token') },
        });
    } catch (error) {
        throw new ApiError(error);
    }
    // Name sent by the server (Content-Disposition), else the given one
    const disposition = response.headers['content-disposition'] || '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const name = fileName || (match ? decodeURIComponent(match[1]) : 'tai-lieu');
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Logged in user (stored at login)
export const currentUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user')) || null;
    } catch (e) {
        return null;
    }
};

export const isAdminUser = () => currentUser()?.role === 'admin';
