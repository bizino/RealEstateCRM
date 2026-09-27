import { Icon } from "@chakra-ui/react";
import React from "react";
import { AiFillFolderOpen, AiOutlineMail } from "react-icons/ai";
import { FaCalendarAlt, FaHandshake, FaTasks } from "react-icons/fa";
import { HiUsers } from "react-icons/hi";
import { LuBuilding2 } from "react-icons/lu";
import { MdContacts, MdEventNote, MdHome, MdInsertChartOutlined, MdLeaderboard } from "react-icons/md";
import { PiPhoneCallBold } from "react-icons/pi";

const icon = (as) => <Icon as={as} width="20px" height="20px" color="inherit" />;

const Dashboard = React.lazy(() => import("views/admin/default"));
const Leads = React.lazy(() => import("views/admin/lead"));
const LeadView = React.lazy(() => import("views/admin/lead/View"));
const Contacts = React.lazy(() => import("views/admin/contact"));
const ContactView = React.lazy(() => import("views/admin/contact/View"));
const Properties = React.lazy(() => import("views/admin/property"));
const PropertyView = React.lazy(() => import("views/admin/property/View"));
const Deals = React.lazy(() => import("views/admin/deal"));
const DealView = React.lazy(() => import("views/admin/deal/View"));
const Meetings = React.lazy(() => import("views/admin/meeting"));
const MeetingView = React.lazy(() => import("views/admin/meeting/View"));
const Tasks = React.lazy(() => import("views/admin/task"));
const TaskView = React.lazy(() => import("views/admin/task/View"));
const Calendar = React.lazy(() => import("views/admin/calender"));
const Calls = React.lazy(() => import("views/admin/phoneCall"));
const CallView = React.lazy(() => import("views/admin/phoneCall/View"));
const Emails = React.lazy(() => import("views/admin/emailHistory"));
const EmailView = React.lazy(() => import("views/admin/emailHistory/View"));
const Documents = React.lazy(() => import("views/admin/document"));
const Reports = React.lazy(() => import("views/admin/reports"));
const Users = React.lazy(() => import("views/admin/users"));
const UserView = React.lazy(() => import("views/admin/users/View"));

const SignIn = React.lazy(() => import("views/auth/signIn"));

// Pages of the application. `section` starts a group of the menu, `hidden`
// pages are not in the menu (detail pages), `adminOnly` pages are only
// registered for admins.
const routes = [
  { name: "Tổng quan", path: "/dashboard", icon: icon(MdHome), component: Dashboard },

  { section: "Kinh doanh", name: "Khách tiềm năng", path: "/leads", icon: icon(MdLeaderboard), component: Leads },
  { name: "Khách tiềm năng", path: "/leads/:id", component: LeadView, hidden: true },
  { name: "Khách hàng", path: "/contacts", icon: icon(MdContacts), component: Contacts },
  { name: "Khách hàng", path: "/contacts/:id", component: ContactView, hidden: true },
  { name: "Bất động sản", path: "/properties", icon: icon(LuBuilding2), component: Properties },
  { name: "Bất động sản", path: "/properties/:id", component: PropertyView, hidden: true },
  { name: "Giao dịch", path: "/deals", icon: icon(FaHandshake), component: Deals },
  { name: "Giao dịch", path: "/deals/:id", component: DealView, hidden: true },

  { section: "Chăm sóc khách hàng", name: "Lịch hẹn", path: "/meetings", icon: icon(MdEventNote), component: Meetings },
  { name: "Lịch hẹn", path: "/meetings/:id", component: MeetingView, hidden: true },
  { name: "Công việc", path: "/tasks", icon: icon(FaTasks), component: Tasks },
  { name: "Công việc", path: "/tasks/:id", component: TaskView, hidden: true },
  { name: "Lịch làm việc", path: "/calendar", icon: icon(FaCalendarAlt), component: Calendar },
  { name: "Cuộc gọi", path: "/calls", icon: icon(PiPhoneCallBold), component: Calls },
  { name: "Cuộc gọi", path: "/calls/:id", component: CallView, hidden: true },
  { name: "Email", path: "/emails", icon: icon(AiOutlineMail), component: Emails },
  { name: "Email", path: "/emails/:id", component: EmailView, hidden: true },

  { section: "Quản lý", name: "Tài liệu", path: "/documents", icon: icon(AiFillFolderOpen), component: Documents },
  { name: "Báo cáo", path: "/reports", icon: icon(MdInsertChartOutlined), component: Reports },
  { name: "Nhân viên", path: "/users", icon: icon(HiUsers), component: Users, adminOnly: true },
  { name: "Hồ sơ nhân viên", path: "/users/:id", component: UserView, hidden: true },
];

export const authRoutes = [
  { name: "Đăng nhập", path: "/auth/sign-in", component: SignIn },
];

export default routes;
