import { getPatientAppointmentsAction } from "@/actions/booking.action";
import { AppointmentsTable } from "./_components/appointments-table";

const AppointmentsPage = async ({ params }) => {
  const { id } = await params;
  const res = await getPatientAppointmentsAction(id);

  return (
    <AppointmentsTable
      userId={id}
      user={res?.user}
      bookings={res?.bookings || []}
      error={res?.success ? null : res?.msg}
    />
  );
};

export default AppointmentsPage;
