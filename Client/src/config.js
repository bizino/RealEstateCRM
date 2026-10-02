// White label settings, set at build time in Client/.env:
// REACT_APP_COMPANY_NAME=Công ty BĐS ABC
// REACT_APP_LOGO_URL=https://.../logo.png
export const COMPANY_NAME = process.env.REACT_APP_COMPANY_NAME || 'CRM Bất động sản';
export const LOGO_URL = process.env.REACT_APP_LOGO_URL || '';
