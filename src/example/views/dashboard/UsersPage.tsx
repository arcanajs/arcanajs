import React from "react";
import { Page } from "../../../lib";

interface UsersPageProps {
  title: string;
  users: string[];
}

const UsersPage: React.FC<UsersPageProps> = ({ title, users }) => {
  return (
    <Page title={title}>
      <h1>{title}</h1>
      <ul>
        {users.map((user, index) => (
          <li key={index}>{user}</li>
        ))}
      </ul>
    </Page>
  );
};

export default UsersPage;
