import axios from "axios"
import { constant } from "constant"

// A 401 means the stored session is not valid anymore (token signed with an old
// JWT_SECRET, user deleted by an admin...): drop it and go back to the sign in page
// instead of showing empty pages. Failed logins also answer 401, they are left alone.
const handleUnauthorized = (error, path) => {
    const hasSession = localStorage.getItem("token") || sessionStorage.getItem("token")
    if (error?.response?.status === 401 && hasSession && !path.includes('api/user/login')) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        sessionStorage.removeItem('token')
        window.location.assign('/auth/sign-in')
    }
}

export const postApi = async (path, data, login) => {
    try {
        let result = await axios.post(constant.baseUrl + path, data, {
            headers: {
                Authorization: localStorage.getItem("token") || sessionStorage.getItem("token")
            }
        })

        if (result.data?.token && result.data?.token !== null) {
            if (login) {
                localStorage.setItem('token', result.data?.token)
            } else {
                sessionStorage.setItem('token', result.data?.token)
            }
            localStorage.setItem('user', JSON.stringify(result.data?.user))
        }
        return result
    } catch (e) {
        console.error(e)
        handleUnauthorized(e, path)
        return e
    }
}
export const putApi = async (path, data, id) => {
    try {
        let result = await axios.put(constant.baseUrl + path, data, {
            headers: {
                Authorization: localStorage.getItem("token") || sessionStorage.getItem("token")
            }
        })
        return result
    } catch (e) {
        console.error(e)
        handleUnauthorized(e, path)
        return e
    }
}

export const deleteApi = async (path, id) => {
    try {
        let result = await axios.delete(constant.baseUrl + path + id, {
            headers: {
                Authorization: localStorage.getItem("token") || sessionStorage.getItem("token")
            }
        })
        if (result.data?.token && result.data?.token !== null) {
            localStorage.setItem('token', result.data?.token)
        }
        return result
    } catch (e) {
        console.error(e)
        handleUnauthorized(e, path)
        return e
    }
}

export const deleteManyApi = async (path, data) => {
    try {
        let result = await axios.post(constant.baseUrl + path, data, {
            headers: {
                Authorization: localStorage.getItem("token") || sessionStorage.getItem("token")
            }
        })
        if (result.data?.token && result.data?.token !== null) {
            localStorage.setItem('token', result.data?.token)
        }
        return result
    } catch (e) {
        console.error(e)
        handleUnauthorized(e, path)
        return e
    }
}

export const getApi = async (path, id) => {
    try {
        if (id) {
            let result = await axios.get(constant.baseUrl + path + id, {
                headers: {
                    Authorization: localStorage.getItem("token") || sessionStorage.getItem("token")
                }
            })
            return result
        }
        else {
            let result = await axios.get(constant.baseUrl + path, {
                headers: {
                    Authorization: localStorage.getItem("token") || sessionStorage.getItem("token")
                }
            })
            return result
        }
    } catch (e) {
        console.error(e)
        handleUnauthorized(e, path)
        return e
    }
}

