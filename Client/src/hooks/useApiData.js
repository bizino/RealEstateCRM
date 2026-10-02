import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { apiGet } from 'services/crm';

// Loads a list (or a record) from the API; `reload` fetches it again after a change.
// Errors are shown once as a toast, `error` keeps the message for the page.
export default function useApiData(path, { initial = [], enabled = true } = {}) {
    const [data, setData] = useState(initial);
    const [isLoading, setIsLoading] = useState(Boolean(enabled && path));
    const [error, setError] = useState(null);
    const initialRef = useRef(initial);

    const reload = useCallback(async () => {
        if (!enabled || !path) return;
        setIsLoading(true);
        try {
            const result = await apiGet(path);
            setData(result ?? initialRef.current);
            setError(null);
        } catch (e) {
            setError(e);
            if (e.status !== 401) toast.error(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [path, enabled]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { data, setData, isLoading, error, reload };
}
