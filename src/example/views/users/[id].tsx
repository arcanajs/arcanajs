import React from "react";
import { Link } from "../../../lib/shared/components/Link";
import { useParams } from "../../../lib/shared/hooks/useParams";

const UserProfilePage = () => {
  // Utilisation du hook useParams pour récupérer les paramètres de l'URL
  const params = useParams();
  const userId = params.id;

  return (
    <div
      style={{ padding: "2rem", border: "1px solid #ccc", borderRadius: "8px" }}
    >
      <h1>Profil Utilisateur Dynamique</h1>

      <div
        style={{
          background: "#f0f0f0",
          padding: "15px",
          borderRadius: "4px",
          margin: "20px 0",
        }}
      >
        <h3>Paramètre récupéré :</h3>
        <p>
          User ID:{" "}
          <strong style={{ color: "blue", fontSize: "1.2em" }}>{userId}</strong>
        </p>
      </div>

      <p>
        Cette page est rendue via le fichier{" "}
        <code>src/views/users/[id].tsx</code>. Le routeur dynamique a extrait "
        <strong>{userId}</strong>" de l'URL.
      </p>

      <div style={{ marginTop: "20px" }}>
        <Link href="/users">Retour à la liste</Link>
      </div>
    </div>
  );
};

export default UserProfilePage;
