import Header from "../components/Header";
import CalcSearchHub from "../components/CalcSearchHub";

export default function HomePage() {
  return (
    <>
      <Header title="Calculator Hub" />

      <main
        className="flex-1 px-10 pb-16"
        style={{ paddingTop: "calc(var(--header-height) + 2.5rem)" }}
      >
        <CalcSearchHub />
      </main>
    </>
  );
}
