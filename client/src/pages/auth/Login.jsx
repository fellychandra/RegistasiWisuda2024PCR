import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigate,
} from "react-router-dom";
import Wrapper from "../../assets/wrappers/RegisterAndLoginPage";
import { FormRow, Logo, SubmitBtn } from "../../components";
import customFetch from "../../utils/customFetch";
import { toast } from "react-toastify";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const errors = { msg: "" };
  if (data.password.length < 3) {
    errors.msg = "password too short";
    return errors;
  }
  try {
    await customFetch.post("/auth/login", data);
    toast.success("Login successful");
    return redirect("/dashboard");
  } catch (error) {
    errors.msg = error?.response?.data?.msg;
    toast.error(errors.msg);
    return errors;
  }
};

const Login = () => {
  const errors = useActionData();
  const navigate = useNavigate();

  const loginDemoUser = async () => {
    const data = {
      email: "test@test.com",
      password: "secret123",
    };
    try {
      await customFetch.post("/auth/login", data);
      toast.success("Take a test application");
      navigate("/dashboard");
    } catch (error) {
      errors.msg = error?.response?.data?.msg;
      console.log("Asdfadf");
    }
  };

  return (
    <Wrapper>
      <Form method="post" className="form">
        <Logo width={250} />
        <h4>Login</h4>
        <FormRow type="email" name="email" labelText={"Email"} />
        <FormRow type="password" name="password" labelText={"Password"} />
        <SubmitBtn formBtn />
        {/* <button type="button" className="btn btn-block" onClick={loginDemoUser}>
          explore the app
        </button>
        <p>
          Not a member yet?
          <Link to="/register" className="member-btn">
            Register
          </Link>
        </p> */}
        <p>
          <Link to="/request-reset-password" className="member-btn">
            Lupa Password?
          </Link>
        </p>
      </Form>
    </Wrapper>
  );
};
export default Login;
