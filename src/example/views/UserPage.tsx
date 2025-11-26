import React from "react";
import { Head } from "../../lib";

interface UserPageProps {
  data?: any;
  navigateTo: (url: string) => void;
}

const UserPage: React.FC<UserPageProps> = ({ data, navigateTo }) => {
  return (
    <>
      <Head>
        <title>User Page - ArcanaJS</title>
        <meta name="description" content="User profile page" />
      </Head>
      <div>
        <h1>User Page</h1>
        <p>Data from server: {JSON.stringify(data)}</p>
        <button onClick={() => navigateTo("/")}>Back to Home</button>
      </div>
    </>
  );
};

export default UserPage;
