import React from 'react';
import ReactDOM from 'react-dom';
import 'assets/css/App.css';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import AuthLayout from 'layouts/auth';
import CrmLayout from 'layouts/crm';
import { ChakraProvider } from '@chakra-ui/react';
import theme from 'theme/theme';
import { ThemeEditorProvider } from '@hypertheme-editor/chakra-ui';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import moment from 'moment';
import 'moment/locale/vi';
import { COMPANY_NAME } from 'config';
import { currentUser } from 'services/crm';

moment.locale('vi');
document.title = COMPANY_NAME;
document.documentElement.lang = 'vi';

function App() {
	const token = localStorage.getItem("token") || sessionStorage.getItem("token");
	const user = currentUser();
	// Re-render on navigation: logging in or out switches the layout
	useNavigate()

	return (
		<>
			<ToastContainer position="top-right" autoClose={3000} newestOnTop />
			<Routes>
				{token && user?.role
					? <Route path="/*" element={<CrmLayout />} />
					: <Route path="/*" element={<AuthLayout />} />}
			</Routes>
		</>
	);
}

ReactDOM.render(
	<ChakraProvider theme={theme}>
		<React.StrictMode>
			<ThemeEditorProvider>
				<Router>
					<App />
				</Router>
			</ThemeEditorProvider>
		</React.StrictMode>
	</ChakraProvider>
	, document.getElementById('root')
);
