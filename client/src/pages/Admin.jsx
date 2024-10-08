import { FaSuitcaseRolling, FaCalendarCheck } from "react-icons/fa";

import { useLoaderData, redirect } from "react-router-dom";
import customFetch from "../utils/customFetch";
import Wrapper from "../assets/wrappers/StatsContainer";
import { toast } from "react-toastify";
import { StatItem } from "../components";

export const loader = async () => {
  try {
    const response = await customFetch.get("/users/admin/app-stats");
    return response.data;
  } catch (error) {
    toast.error("You are not authorized to view this page");
    return redirect("/dashboard");
  }
};

const Admin = () => {
  const { users } = useLoaderData();
  const stats = [
    {
      title: "Seluruh Users",
      count: users || 0,
      icon: <FaSuitcaseRolling />,
      color: "#e9b949",
      bcg: "#fcefc7",
      link: "all-users",
    },
  ];

  return (
    <Wrapper>
      {stats.map((item, i) => {
        return <StatItem key={i} {...item} />;
      })}
    </Wrapper>
  );
};
export default Admin;
