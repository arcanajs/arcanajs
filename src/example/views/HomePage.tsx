import React from "react";
import { Head } from "../../lib";
import { InfoCard } from "./components/InfoCard";

interface HomePageProps {
  navigateTo: (url: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ navigateTo }) => {
  return (
    <>
      <Head>
        <title>Home Page - ArcanaJS SSR Hybrid</title>
      </Head>

      <div>
        <h1>Welcome SSR mohammed ben cheikh </h1>
        <p>This is the Home Page rendered initially on the server.</p>

        <InfoCard title="Reusable Component">
          This is a component imported from <code>src/example/components/</code>
          . You can use it on any page!
        </InfoCard>

        <button onClick={() => navigateTo("/UserPage")}>Go to User</button>
      </div>
    </>
  );
};

export default HomePage;
