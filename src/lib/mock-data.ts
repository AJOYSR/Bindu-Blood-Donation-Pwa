import type { BloodGroup, BloodRequest, Donor, NotificationItem } from '../types'
import bangladeshDistricts from '../data/bangladesh-districts.json'

export const bloodGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
export const districts: string[] = bangladeshDistricts

export const donors: Donor[] = [
  { id: 'd1', displayName: 'Nadia R.', bloodGroup: 'O+', district: 'Dhaka', area: 'Dhanmondi', distanceKm: 1.8, verified: true, available: true, lastDonation: '2026-06-14', responseRate: 96, donations: 8, maskedPhone: '0171****8' },
  { id: 'd2', displayName: 'Sajid H.', bloodGroup: 'A+', district: 'Dhaka', area: 'Mirpur', distanceKm: 3.2, verified: true, available: true, lastDonation: '2026-05-22', responseRate: 91, donations: 5, maskedPhone: '0182****4' },
  { id: 'd3', displayName: 'Farhan A.', bloodGroup: 'B+', district: 'Dhaka', area: 'Uttara', distanceKm: 5.1, verified: false, available: true, lastDonation: '2026-07-02', responseRate: 84, donations: 3, maskedPhone: '0193****1' },
  { id: 'd4', displayName: 'Mehjabin S.', bloodGroup: 'AB-', district: 'Chattogram', area: 'Panchlaish', distanceKm: 2.6, verified: true, available: true, lastDonation: null, responseRate: 98, donations: 4, maskedPhone: '0164****7' },
  { id: 'd5', displayName: 'Tanvir K.', bloodGroup: 'O-', district: 'Dhaka', area: 'Mohammadpur', distanceKm: 4.3, verified: true, available: false, lastDonation: '2026-09-04', responseRate: 89, donations: 11, maskedPhone: null },
  { id: 'd6', displayName: 'Anika T.', bloodGroup: 'A-', district: 'Rajshahi', area: 'Boalia', distanceKm: 3.9, verified: true, available: true, lastDonation: '2026-04-10', responseRate: 94, donations: 6, maskedPhone: '0155****2' }
]

export const requests: BloodRequest[] = [
  { id: 'BR-2048', patientName: 'Patient protected', bloodGroup: 'O-', units: 2, hospital: 'Square Hospital', district: 'Dhaka', area: 'Panthapath', urgency: 'critical', status: 'open', neededBy: '2026-10-20T19:00:00+06:00', createdAt: '2026-10-20T10:15:00+06:00', responses: 2, note: 'Emergency surgery. Donors will be screened by the hospital.' },
  { id: 'BR-2047', patientName: 'Patient protected', bloodGroup: 'B+', units: 1, hospital: 'Dhaka Medical College', district: 'Dhaka', area: 'Bakshibazar', urgency: 'urgent', status: 'matched', neededBy: '2026-10-21T09:00:00+06:00', createdAt: '2026-10-20T08:40:00+06:00', responses: 5, note: 'Please respond only if eligible to donate today.' },
  { id: 'BR-2046', patientName: 'Patient protected', bloodGroup: 'AB-', units: 3, hospital: 'Evercare Hospital', district: 'Dhaka', area: 'Bashundhara', urgency: 'urgent', status: 'open', neededBy: '2026-10-21T16:00:00+06:00', createdAt: '2026-10-19T21:20:00+06:00', responses: 1, note: 'Rare blood group needed for a scheduled procedure.' },
  { id: 'BR-2045', patientName: 'Patient protected', bloodGroup: 'A+', units: 2, hospital: 'Chattogram Medical College', district: 'Chattogram', area: 'Panchlaish', urgency: 'standard', status: 'open', neededBy: '2026-10-23T12:00:00+06:00', createdAt: '2026-10-19T17:05:00+06:00', responses: 3, note: 'Two units requested. Hospital blood bank confirmation available.' },
  { id: 'BR-2044', patientName: 'Patient protected', bloodGroup: 'O+', units: 1, hospital: 'United Hospital', district: 'Dhaka', area: 'Gulshan', urgency: 'standard', status: 'fulfilled', neededBy: '2026-10-20T11:00:00+06:00', createdAt: '2026-10-18T14:30:00+06:00', responses: 7, note: 'Request fulfilled and verified by operations.' }
]

export const notifications: NotificationItem[] = [
  { id: 'n1', title: 'You may be a match', message: 'An O+ request is 2.4 km away and needs help today.', time: '8 min ago', read: false, tone: 'warning' },
  { id: 'n2', title: 'Response accepted', message: 'The requester for BR-2031 accepted your response.', time: '2 hr ago', read: false, tone: 'success' },
  { id: 'n3', title: 'Availability ending soon', message: 'Extend your availability if you are still able to donate.', time: 'Yesterday', read: true, tone: 'info' }
]

export const supplyGap = [
  { district: 'Dhaka', 'A+': 'ok', 'A-': 'low', 'B+': 'ok', 'B-': 'critical', 'O+': 'low', 'O-': 'critical', 'AB+': 'ok', 'AB-': 'low' },
  { district: 'Chattogram', 'A+': 'low', 'A-': 'ok', 'B+': 'low', 'B-': 'ok', 'O+': 'ok', 'O-': 'low', 'AB+': 'ok', 'AB-': 'ok' },
  { district: 'Rajshahi', 'A+': 'ok', 'A-': 'critical', 'B+': 'low', 'B-': 'low', 'O+': 'ok', 'O-': 'critical', 'AB+': 'low', 'AB-': 'critical' },
  { district: 'Sylhet', 'A+': 'low', 'A-': 'low', 'B+': 'ok', 'B-': 'critical', 'O+': 'low', 'O-': 'low', 'AB+': 'ok', 'AB-': 'critical' }
] as const

export const weeklyRequests = [
  { day: 'Mon', created: 24, fulfilled: 16 }, { day: 'Tue', created: 31, fulfilled: 22 },
  { day: 'Wed', created: 27, fulfilled: 20 }, { day: 'Thu', created: 38, fulfilled: 27 },
  { day: 'Fri', created: 42, fulfilled: 31 }, { day: 'Sat', created: 35, fulfilled: 29 },
  { day: 'Sun', created: 29, fulfilled: 23 }
]
