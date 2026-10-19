import { getUserAccountInfobyid } from '@/actions/account.action';
import React from 'react';
import AdminNavigation from '../_components/admin-navigation';
import { formatShortDate } from '@/lib/utils';
import { UpdateAccountForm } from '../_components/update-account';
import { getRecordByUserId } from '@/actions/record.action';
import { getHistoryByUserId } from '@/actions/history.action';
import { getMedicationByUserId } from '@/actions/medication.action';
import { getPatientAppointmentsAction } from '@/actions/booking.action';
import { RecordTable } from '../records/_components/record-table';
import { HistoryTable } from '../history/_components/history-table';
import { MedicationTable } from '../medications/_components/medication-table';
import { AppointmentsTable } from '../appointments/_components/appointments-table';

const page = async ({ params }) => {
  const { id } = await params;
  const [{ success, user }, records, history, medications, appointments] =
    await Promise.all([
      getUserAccountInfobyid(id),
      getRecordByUserId(id),
      getHistoryByUserId(id),
      getMedicationByUserId(id),
      getPatientAppointmentsAction(id),
    ]);

  if (!success) {
    return <div className="text-center text-red-500">User not found</div>;
  }

  return (
    <div className="container mx-auto p-10">
        <div className='sticky top-0 z-20 -mx-10 mb-4 flex items-center gap-4 bg-[#FAF9F8] px-10 py-3'>
                <AdminNavigation userId={id} />
              </div>

              <UpdateAccountForm user={user} />
   

      <div id="account-info" className="scroll-mt-20 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/3">
            <img
              src={user.account?.profileImage || '/images/profile-placeholder.png'}
              alt="Profile"
              className="w-32 h-32 rounded-full mx-auto mb-4"
            />
            <div className="text-center">
              <h2 className="text-xl font-medium">{user.account?.firstName} {user.account?.lastName}</h2>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="w-full lg:w-2/3">
            <h2 className="text-2xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <p className="text-gray-600">Phone Number</p>
                <p className="text-gray-800">{user.account?.phoneNumber}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Second Email</p>
                <p className="text-gray-800">{user.account?.secondEmail}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Date of Birth</p>
                <p className="text-gray-800">{formatShortDate(user.account?.dob)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">NHS Number</p>
                <p className="text-gray-800">{user.account?.nhsNumber || 'N/A'}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Address</p>
                <p className="text-gray-800">{user.account?.address}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Post Code</p>
                <p className="text-gray-800">{user.account?.zipCode}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Delivery Address</p>
                <p className="text-gray-800">{user.account?.deliveryAddress || 'N/A'}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Delivery Post Code</p>
                <p className="text-gray-800">{user.account?.deliveryZipCode || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-10 px-6">
        <section id="medical-records" className="scroll-mt-20">
          <RecordTable record={records?.records} userId={id} user={user} embedded />
        </section>
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-2 [&>*]:min-w-0">
          <section id="medical-history" className="scroll-mt-20">
            <HistoryTable history={history?.history} userId={id} user={user} embedded />
          </section>
          <section id="medications" className="scroll-mt-20">
            <MedicationTable medications={medications?.medication} userId={id} user={user} embedded />
          </section>
        </div>
        <section id="appointments" className="scroll-mt-20">
          <AppointmentsTable
            userId={id}
            user={user}
            bookings={appointments?.bookings || []}
            error={appointments?.success ? null : appointments?.msg}
            embedded
          />
        </section>
      </div>
    </div>
  );
};

export default page;