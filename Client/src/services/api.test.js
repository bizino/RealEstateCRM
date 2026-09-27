import axios from 'axios';
import { getApi, postApi } from './api';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));

const httpError = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: {} } });

describe('api service session handling', () => {
    const { location } = window;

    beforeEach(() => {
        delete window.location;
        window.location = { assign: jest.fn() };
        jest.spyOn(console, 'error').mockImplementation(() => { });
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        window.location = location;
        jest.restoreAllMocks();
    });

    test('drops the stored session and goes to sign in when the API answers 401', async () => {
        localStorage.setItem('token', 'stale-token');
        localStorage.setItem('user', '{"_id":"1"}');
        axios.get.mockRejectedValue(httpError(401));

        await getApi('api/contact/');

        expect(localStorage.getItem('token')).toBeNull();
        expect(window.location.assign).toHaveBeenCalledWith('/auth/sign-in');
    });

    test('also handles sessions kept in sessionStorage', async () => {
        sessionStorage.setItem('token', 'stale-token');
        axios.get.mockRejectedValue(httpError(401));

        await getApi('api/user/view/', '1');

        expect(sessionStorage.getItem('token')).toBeNull();
        expect(window.location.assign).toHaveBeenCalledWith('/auth/sign-in');
    });

    test('a failed login (401) stays on the sign in page', async () => {
        axios.post.mockRejectedValue(httpError(401));

        const result = await postApi('api/user/login', { username: 'a@b.c', password: 'wrong' });

        expect(result.response.status).toBe(401);
        expect(window.location.assign).not.toHaveBeenCalled();
    });

    test('other errors keep the session', async () => {
        localStorage.setItem('token', 'valid-token');
        axios.get.mockRejectedValue(httpError(403));

        const result = await getApi('api/user/');

        expect(result.response.status).toBe(403);
        expect(localStorage.getItem('token')).toBe('valid-token');
        expect(window.location.assign).not.toHaveBeenCalled();
    });
});
