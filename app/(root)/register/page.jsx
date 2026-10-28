import { loggedInUserAction } from "@/actions/user.action";
import RegisterForm from "./_components/registerForm";
import Link from "next/link";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Register",
  description: "Free Oral Contraception, Delivered to Your Door",
};
const RegisterPage = async () => {
  const payload = await loggedInUserAction();

  if (payload?.payload?.email) {
    // Registering sets the login cookie and Next re-renders this page before
    // the form's own redirect runs, so this redirect decides where a new
    // patient lands (client: straight to ordering).
    redirect("/booking/order");
  }
  return (
    <>
      <section className='section-padding'>
        <div className='container custom-container mx-auto sm:px-0 px-[24px]'>
          <div className='p-4 md:p-[40px] shadow-[0_10px_80px_0_rgba(30,96,221,0.1)] rounded-[12px] max-w-[670px] mx-auto space-y-[30px]'>
            <h2 className='text-center text-[#1F2122] text-[24px] md:text-[32px] font-semibold'>
              Registration
            </h2>
            <RegisterForm />
            <p className='text-center text-[#1D2D44] text-base'>
              Already have an account?
              <Link href='/login' className='text-[#d67b0e] underline ml-2'>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
};

export default RegisterPage;
