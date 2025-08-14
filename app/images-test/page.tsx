export default function Page() {
  return (
    <main style={{padding: 32}}>
      <h1>Test imagen pública</h1>
      <p>Deberías ver la imagen debajo:</p>
      <img src="/images/bg-categorias.jpg?v=9" alt="test" style={{maxWidth: 480, border: "1px solid #ddd"}} />
    </main>
  );
}
