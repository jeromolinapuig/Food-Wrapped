import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';

export function PrivacyPage() {

  return (
    <AppShell>
      <PageHeader
        title="Politica de privacidad"
        subtitle="Como usamos tu informacion en Burger Wrapped."
      />
      <main className="bw-main">
        <section className="bw-card" style={{ padding: 20 }}>
          <p>
            Esta politica describe como Burger Wrapped recopila y usa la informacion cuando
            inicias sesion y usas la app. Al usar la aplicacion aceptas esta politica.
          </p>
          <h3 style={{ marginTop: 16 }}>Datos que recopilamos</h3>
          <ul>
            <li>Cuenta: email y nombre de usuario.</li>
            <li>Contenido: tus publicaciones, notas y comentarios.</li>
            <li>Uso basico: acciones dentro de la app para mejorar el servicio.</li>
          </ul>
          <h3 style={{ marginTop: 16 }}>Como usamos tus datos</h3>
          <ul>
            <li>Para autenticarte y mantener tu sesion activa.</li>
            <li>Para mostrar tu perfil y contenido a otros usuarios.</li>
            <li>Para mejorar la experiencia y la estabilidad de la app.</li>
          </ul>
          <h3 style={{ marginTop: 16 }}>Compartir informacion</h3>
          <p>
            No vendemos tus datos. Solo compartimos informacion cuando es necesaria para
            operar la app o por requerimientos legales.
          </p>
          <h3 style={{ marginTop: 16 }}>Contacto</h3>
          <p>
            Si tienes dudas sobre esta politica, escribe a{' '}
            <a href="mailto:burgerwrapped@gmail.com">burgerwrapped@gmail.com</a>.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
