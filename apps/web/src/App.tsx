import { Route, Routes } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import SignIn from "./routes/SignIn";
import Feed from "./routes/Feed";
import RecipeDetail from "./routes/RecipeDetail";
import CookMode from "./routes/CookMode";
import LogCook from "./routes/LogCook";
import Add from "./routes/Add";
import AddManual from "./routes/AddManual";
import Setup from "./routes/Setup";
import SetupStep3 from "./routes/SetupStep3";
import { DEV_SKIP_AUTH } from "./lib/devMode";

export default function App() {
  const { session, loading } = useSession();

  if (loading && !DEV_SKIP_AUTH) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-body text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (!session && !DEV_SKIP_AUTH) {
    return <SignIn />;
  }

  return (
    <Routes>
      <Route path="/" element={<Feed />} />
      <Route path="/recipe/:id" element={<RecipeDetail />} />
      <Route path="/recipe/:id/cook" element={<CookMode />} />
      <Route path="/recipe/:id/log" element={<LogCook />} />
      <Route path="/add" element={<Add />} />
      <Route path="/add/manual" element={<AddManual />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/setup/step-3" element={<SetupStep3 />} />
    </Routes>
  );
}
