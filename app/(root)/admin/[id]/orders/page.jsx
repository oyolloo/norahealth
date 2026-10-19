import { redirect } from "next/navigation";

const OrderPage = async ({ params }) => {
  const { id } = await params;
  // Orders now live on the combined patient record
  redirect(`/admin/${id}/account#orders`);
};

export default OrderPage;
