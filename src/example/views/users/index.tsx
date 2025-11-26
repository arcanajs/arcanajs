import React from "react";
import { Link } from "../../../lib/shared/components/Link";

const UsersIndexPage = () => {
  const users = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "123", name: "Charlie (Dynamic)" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Liste des Utilisateurs</h1>
      <p>Cet exemple montre comment naviguer vers des routes dynamiques.</p>
      <ul>
        {users.map((user) => (
          <li key={user.id} style={{ margin: "10px 0" }}>
            <Link href={`/users/${user.id}`}>
              Voir le profil de {user.name}
            </Link>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "20px" }}>
        <Link href="/">Retour à l'accueil</Link>
      </div>
    </div>
  );
};

export default UsersIndexPage;
