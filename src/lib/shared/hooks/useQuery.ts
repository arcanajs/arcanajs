import useLocation from "./useLocation";

const useQuery = () => {
  const { search } = useLocation();
  return new URLSearchParams(search);
};
export default useQuery;
