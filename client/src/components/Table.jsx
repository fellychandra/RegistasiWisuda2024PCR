import DataTable from "react-data-table-component";
import { useLocation, useNavigate } from "react-router-dom";
import TabelContainer from "../assets/wrappers/Tabel";
import { useDashboardContext } from "../pages/DashboardLayout";
import {
  getMahasiswaColumns,
  getOrangtuaColumns,
  getColumnsUsers,
} from "../utils/columns";
import { BiExport } from "react-icons/bi";
import customFetch from "../utils/customFetch";

export const checkDefaultTheme = () => {
  const isDarkThemes = localStorage.getItem("darkTheme") === "true";
  return isDarkThemes === true ? "dark" : "default";
};

const Table = ({ titleTable, context }) => {
  const { isDarkTheme } = useDashboardContext();
  const { search, pathname } = useLocation();
  const navigate = useNavigate();

  const { data, total } = context;

  let columns,
    linkUrl = "";

  if (pathname.includes("/mahasiswa")) {
    columns = getMahasiswaColumns(navigate);
    linkUrl = "mahasiswa";
  } else if (pathname.includes("/orangtua")) {
    columns = getOrangtuaColumns(navigate);
    linkUrl = "orangtua";
  } else if (pathname.includes("/admin")) {
    columns = getColumnsUsers(navigate);
    linkUrl = "admin";
  }

  const handlePageChange = (page) => {
    const searchParams = new URLSearchParams(search);
    searchParams.set("page", page);
    navigate(`${pathname}?${searchParams.toString()}`);
  };

  const handlePerRowsChange = (limit) => {
    const searchParams = new URLSearchParams(search);
    searchParams.set("limit", limit);
    navigate(`${pathname}?${searchParams.toString()}`);
  };

  const handleExportPDF = async () => {
    try {
      const response = await customFetch.get(`${linkUrl}/export`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: response.data.type });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `${linkUrl}.pdf`;
      link.click();
    } catch (error) {
      console.error("Error exporting PDF:", error);
    }
  };

  return (
    <TabelContainer>
      <DataTable
        columns={columns}
        data={data}
        title={titleTable}
        pagination
        paginationServer
        paginationTotalRows={total}
        onChangePage={handlePageChange}
        onChangeRowsPerPage={handlePerRowsChange}
        fixedHeader
        theme={checkDefaultTheme()}
        highlightOnHover
        actions={
          linkUrl == "admin" ? (
            ""
          ) : (
            <button type="button" className="btn" onClick={handleExportPDF}>
              <BiExport size={15} style={{ marginRight: "0.3rem" }} /> Export
              PDF
            </button>
          )
        }
      />
    </TabelContainer>
  );
};

export default Table;
