import { redirect } from "next/navigation";

// Folded into the combined patient record on /account (CC-5).
const Page = async ({ params }) => {
  const { id } = await params;
  redirect(`/admin/${id}/account`);
};

export default Page;
