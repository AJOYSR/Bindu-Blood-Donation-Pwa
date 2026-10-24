import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './app/Shell'
import { LoadingScreen } from './components/LoadingScreen'
import Landing from './routes/Landing'
import FindDonors from './routes/FindDonors'
import Requests from './routes/Requests'
import RequestDetail from './routes/RequestDetail'
import NewRequest from './routes/NewRequest'
import Register from './routes/Register'
import Dashboard from './routes/Dashboard'
import Profile from './routes/Profile'
import About from './routes/About'
import Contacts from './routes/Contacts'
import DonorProfile from './routes/DonorProfile'
import { ProtectedRoute } from './components/ProtectedRoute'

const AdminShell=lazy(()=>import('./app/AdminShell').then(module=>({default:module.AdminShell})))
const AdminOverview=lazy(()=>import('./routes/admin/AdminOverview'))
const AdminRequests=lazy(()=>import('./routes/admin/AdminRequests'))
const AdminDonors=lazy(()=>import('./routes/admin/AdminDonors'))
const AdminReports=lazy(()=>import('./routes/admin/AdminReports'))
const AdminVerification=lazy(()=>import('./routes/admin/AdminVerification'))
const AdminAnalytics=lazy(()=>import('./routes/admin/AdminAnalytics'))
const AdminAuditLog=lazy(()=>import('./routes/admin/AdminAuditLog'))

export default function App(){return <Suspense fallback={<LoadingScreen/>}><Routes><Route element={<Shell/>}><Route path="/" element={<Landing/>}/><Route path="/find-donors" element={<FindDonors/>}/><Route path="/donors/:id" element={<DonorProfile/>}/><Route path="/requests" element={<Requests/>}/><Route path="/requests/new" element={<ProtectedRoute><NewRequest/></ProtectedRoute>}/><Route path="/requests/:id" element={<RequestDetail/>}/><Route path="/register" element={<Register/>}/><Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/><Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>}/><Route path="/about" element={<About/>}/><Route path="/contacts" element={<Contacts/>}/><Route path="/admin" element={<AdminShell/>}><Route index element={<AdminOverview/>}/><Route path="requests" element={<AdminRequests/>}/><Route path="donors" element={<AdminDonors/>}/><Route path="reports" element={<AdminReports/>}/><Route path="verification" element={<AdminVerification/>}/><Route path="analytics" element={<AdminAnalytics/>}/><Route path="audit-log" element={<AdminAuditLog/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></Suspense>}
