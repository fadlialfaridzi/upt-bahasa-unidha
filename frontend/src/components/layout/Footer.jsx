function Footer() {
  return (
    <footer style={{
      background: '#1e3a5f',
      color: 'rgba(255,255,255,0.8)',
      textAlign: 'center',
      padding: '1.5rem',
      fontSize: '0.875rem',
    }}>
      <p>© {new Date().getFullYear()} UPT Bahasa - Universitas Dharma Andalas. Hak cipta dilindungi.</p>
    </footer>
  );
}

export default Footer;
