import  useRouter  from "./useRouter";

const useLocation = () => {
  const { currentUrl } = useRouter();
  return {
    pathname: currentUrl,
    search: typeof window !== "undefined" ? window.location.search : "",
    hash: typeof window !== "undefined" ? window.location.hash : "",
  };
};
export default useLocation;
