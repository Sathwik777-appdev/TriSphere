const styles = {
  container: {
    minHeight: '100vh',
    fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    position: 'relative',
    color: '#ffffff',
    overflowY: 'visible'
  },
  header: {
    padding: 'clamp(12px, 2vh, 20px) clamp(16px, 4vw, 48px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'transparent',
    color: 'white',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    position: 'sticky',
    top: 0
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 20
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    cursor: 'pointer',
    transition: 'transform 0.3s ease'
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: '16px',
    objectFit: 'cover',
    boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    background: 'linear-gradient(to right, #ffffff, #94a3b8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    margin: '2px 0 0 0',
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  welcomeMessage: {
    marginTop: 4
  },
  welcomeMainText: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  welcomeSubText: {
    margin: '2px 0 0 0',
    fontSize: 12,
    color: 'rgba(203, 213, 225, 0.95)'
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  schoolDisplay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 24px',
    background: 'transparent',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)'
  },
  schoolLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#60a5fa',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: 2
  },
  schoolValue: {
    fontSize: 20,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '0.5px'
  },
  settingsContainer: {
    position: 'relative'
  },
  settingsBtn: {
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  settingsDropdown: {
    position: 'absolute',
    top: 'calc(100% + 15px)',
    right: 0,
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '24px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(59, 130, 246, 0.1)',
    padding: '24px',
    minWidth: '320px',
    zIndex: 1000,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    animation: 'fadeIn 0.3s ease-out'
  },
  settingsSection: {
    padding: '8px 0'
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '4px'
  },
  settingsValue: {
    fontSize: 15,
    fontWeight: 600,
    color: '#ffffff'
  },
  settingsDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    margin: '16px 0'
  },
  logoutBtnDropdown: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    marginTop: 8,
    transition: 'all 0.2s ease'
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(200px, 20vw, 260px), 1fr))',
    gap: 'clamp(12px, 2vw, 20px)',
    padding: 'clamp(16px, 4vh, 32px) clamp(16px, 4vw, 48px)',
    maxWidth: 1600,
    margin: '0 auto'
  },
  statCard: {
    background: 'transparent',
    borderRadius: 20,
    padding: 'clamp(16px, 3vw, 28px)',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    overflow: 'hidden'
  },
  statIcon: {
    fontSize: 32,
    width: 64,
    height: 64,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    color: '#60a5fa'
  },
  statContent: {
    flex: 1
  },
  statValue: {
    fontSize: 32,
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: '-1px'
  },
  statLabel: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: 600
  },
  content: {
    padding: '0 clamp(16px, 4vw, 48px) clamp(24px, 5vh, 48px) clamp(16px, 4vw, 48px)',
    maxWidth: 1600,
    margin: '0 auto'
  },
  viewNavigation: {
    display: 'flex',
    gap: 10,
    marginBottom: 32,
    padding: '8px',
    background: 'transparent',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none'
  },
  viewButton: {
    padding: '14px 28px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(6px, 1.5vw, 12px)',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  },
  viewButtonActive: {
    background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
    border: '1px solid rgba(96, 165, 250, 0.3)',
    color: '#ffffff',
    fontWeight: '800',
    boxShadow: '0 8px 32px rgba(96, 165, 250, 0.2)',
  },
  viewIcon: {
    fontSize: 20
  },
  viewLabel: {
    fontSize: 14,
    fontWeight: 700
  },
  viewContent: {
    minHeight: 500,
    background: 'transparent',
    borderRadius: '24px',
    padding: 40,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 500,
    color: '#ffffff',
    background: 'transparent',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  spinner: {
    width: 48,
    height: 48,
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid #60a5fa',
    borderRadius: '50%',
    animation: 'spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
    marginBottom: 20
  },
  overviewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 40
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 20,
    letterSpacing: '-0.2px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 20
  },
  overviewCard: {
    background: 'transparent',
    borderRadius: '20px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
  },
  overviewIcon: {
    fontSize: 32,
    width: 60,
    height: 60,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  overviewContent: {
    flex: 1
  },
  overviewValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: 2,
    letterSpacing: '-0.5px'
  },
  overviewLabel: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: 600
  },
  quickActions: {
    background: 'transparent',
    borderRadius: '24px',
    padding: 32,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
  },
  quickActionsSubtitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16
  },
  actionButton: {
    padding: '16px 24px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  messagesTableContainer: {
    background: 'transparent',
    borderRadius: '24px',
    padding: 32,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
  },
  tableTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 20
  },
  searchContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchInput: {
    padding: '14px 44px 14px 48px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    fontSize: 14,
    width: 'min(360px, 100%)',
    outline: 'none',
    transition: 'all 0.3s ease',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#ffffff',
    boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)'
  },
  clearSearchButton: {
    position: 'absolute',
    right: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '50%',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 12,
    color: '#94a3b8',
    transition: 'all 0.2s ease'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginTop: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    width: '100%'
  },
  messagesTable: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'transparent'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'transparent'
  },
  messagesTableHeader: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  tableHeader: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  th: {
    padding: '20px 24px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 700,
    color: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  tableRow: {
    backgroundColor: 'transparent',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'all 0.2s ease',
    cursor: 'pointer'
  },
  td: {
    padding: '20px 24px',
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: 500
  },
  tableViewButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    color: '#60a5fa',
    border: '1px solid rgba(96, 165, 250, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.2s ease'
  },
  userEmptyState: {
    textAlign: 'center',
    padding: 48,
    color: '#ffffff',
    fontSize: 14
  },
  analyticsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20
  },
  analyticsCard: {
    background: 'transparent',
    borderRadius: 12,
    padding: 22,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: 16
  },
  analyticsContent: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 1.7
  },
  analyticsItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)'
  },
  analyticsLabel: {
    color: '#ffffff',
    fontSize: 14
  },
  analyticsValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700
  },
  announcementsContainer: {
    background: 'transparent',
    borderRadius: 12,
    padding: 28,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
  },
  announcementForm: {
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#ffffff'
  },
  formSelect: {
    padding: '12px 14px',
    fontSize: 14,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#ffffff',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.2s ease',
    outline: 'none'
  },
  formInput: {
    padding: '12px 14px',
    fontSize: 14,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#ffffff',
    transition: 'border-color 0.2s ease',
    outline: 'none'
  },
  formTextarea: {
    padding: '12px 14px',
    fontSize: 14,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#ffffff',
    transition: 'border-color 0.2s ease',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 120,
    lineHeight: 1.5
  },
  charCount: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'right',
    marginTop: 4
  },
  messageSubmitButton: {
    padding: '14px 24px',
    backgroundColor: '#1e4976',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'background-color 0.2s ease',
    marginTop: 8
  },
  successMessage: {
    padding: '14px 18px',
    backgroundColor: '#059669',
    color: 'white',
    borderRadius: 8,
    marginBottom: 18,
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center'
  },
  refreshButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    letterSpacing: '0.3px'
  },
  classSelect: {
    padding: '10px 14px',
    fontSize: 13,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    color: '#111827',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'border-color 0.2s ease',
    outline: 'none',
    minWidth: 140
  },
  classSelectLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
    borderRadius: 14,
    maxWidth: 640,
    width: '92%',
    maxHeight: '85vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  modalHeader: {
    padding: '22px 28px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.8)'
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#ffffff'
  },
  closeButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    cursor: 'pointer',
    color: '#ffffff',
    transition: 'background-color 0.2s ease'
  },
  modalBody: {
    padding: 28,
    overflowY: 'auto',
    flex: 1
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTop: '1px solid rgba(59, 130, 246, 0.3)'
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: 8,
    color: '#94a3b8',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.2s ease'
  },
  saveBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: 8,
    color: 'white',
    cursor: 'pointer',
    fontWeight: 600,
    boxShadow: '0 4px 12px rgba(121, 40, 202, 0.3)',
    transition: 'all 0.2s ease'
  },
  detailSection: {
    marginBottom: 24
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff'
  },
  detailNote: {
    fontSize: 14,
    color: 'rgba(148, 163, 184, 0.9)',
    fontStyle: 'italic',
    padding: 14,
    backgroundColor: 'rgba(30, 58, 95, 0.5)',
    borderRadius: 8,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    lineHeight: 1.5
  },
  actionButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12
  },
  actionBtn: {
    padding: '12px 16px',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'background-color 0.2s ease'
  },
  suspendedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '16px 20px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    margin: '0 20px 20px 20px'
  },
  suspendedIcon: {
    fontSize: 28,
    flexShrink: 0
  },
  suspendedText: {
    flex: 1
  },
  createUserContainer: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 95, 0.95))',
    borderRadius: 12,
    padding: 'clamp(16px, 4vw, 28px)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    backdropFilter: 'blur(10px)'
  },
  createUserForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 18
  },
  checkboxGroup: {
    padding: 16,
    backgroundColor: 'rgba(30, 58, 95, 0.6)',
    borderRadius: 10,
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    fontWeight: 500,
    color: '#ffffff',
    cursor: 'pointer'
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: '#1e4976'
  },
  parentSection: {
    padding: 20,
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: 10,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  formHint: {
    fontSize: 12,
    color: 'rgba(147, 197, 253, 0.8)',
    marginTop: 4
  },
  subsectionTitle: {
    margin: '0 0 12px 0',
    fontSize: 16,
    fontWeight: 600,
    color: '#ffffff'
  },
  announcementSubmitButton: {
    padding: '14px 28px',
    backgroundColor: '#1e4976',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    transition: 'background-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8
  },
  buttonSpinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  errorMessage: {
    padding: 14,
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#dc2626',
    fontSize: 14,
    fontWeight: 500
  },
  notificationToast: {
    position: 'fixed',
    top: 20,
    right: 20,
    minWidth: 300,
    maxWidth: 450,
    padding: '14px 18px',
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 10000,
    animation: 'slideInRight 0.3s ease-out'
  },
  notificationSuccess: {
    backgroundColor: '#059669',
    color: 'white'
  },
  notificationError: {
    backgroundColor: '#dc2626',
    color: 'white'
  },
  notificationContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  notificationIcon: {
    fontSize: 18,
    flexShrink: 0
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.4
  },
  notificationClose: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: 6,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 16,
    color: 'white',
    transition: 'background-color 0.2s ease',
    flexShrink: 0
  },
  announcementHistory: {
    marginTop: 32,
    paddingTop: 24,
    borderTop: '1px solid #e5e7eb'
  },
  announcementSubtitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 18
  },
  announcementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  announcementCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 18,
    transition: 'box-shadow 0.2s ease'
  },
  announcementHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 8
  },
  announcementMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center'
  },
  announcementBadge: {
    padding: '4px 10px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    color: '#374151'
  },
  announcementDate: {
    fontSize: 12,
    color: '#6b7280'
  },
  announcementAuthor: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic'
  },
  announcementMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 1.6,
    margin: 0
  },
  deleteAnnouncementBtn: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    padding: 8,
    cursor: 'pointer',
    fontSize: 16,
    transition: 'background-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    color: '#dc2626'
  },
  announcementEmptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#9ca3af',
    fontSize: 14
  },
  performanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(140px, 15vw, 160px), 1fr))',
    gap: 14
  },
  performanceCard: {
    backgroundColor: 'rgba(30, 58, 95, 0.6)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 10,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  performanceIcon: {
    fontSize: 24,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  performanceData: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  performanceValue: {
    fontSize: 22,
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1
  },
  performanceLabel: {
    fontSize: 11,
    color: 'rgba(148, 163, 184, 1)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  lessonCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 16,
    border: '1px solid #e5e7eb'
  },
  lessonHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827'
  },
  lessonContent: {
    marginTop: 12,
    whiteSpace: 'pre-wrap',
    color: '#374151',
    fontSize: 14,
    lineHeight: 1.6,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    border: '1px solid #e5e7eb'
  },
  lessonFooter: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600
  },
  feedbackCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 16,
    border: '1px solid #e5e7eb'
  },
  feedbackCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  feedbackUserName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  feedbackUserRole: {
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: '#e5e7eb',
    color: '#374151',
    padding: '4px 10px',
    borderRadius: 6
  },
  feedbackUserClass: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4
  },
  feedbackTimestamp: {
    fontSize: 11,
    color: '#9ca3af',
    whiteSpace: 'nowrap'
  },
  feedbackText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 1.6,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    marginBottom: 8,
    whiteSpace: 'pre-wrap'
  },
  feedbackEmail: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic'
  },
  feedbackBtn: {
    padding: '10px 18px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 0.2s ease',
    color: 'white'
  },
  leaderboardContainer: {
    padding: 'clamp(16px, 3vw, 28px)',
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    marginBottom: 24,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    fontFamily: '"Times New Roman", Times, serif'
  },
  highlightCard: {
    padding: 'clamp(16px, 3vw, 28px)',
    borderRadius: 8,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    textAlign: 'left',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    border: '1px solid #e5e7eb',
    fontFamily: '"Times New Roman", Times, serif'
  },
  highlightStat: {
    padding: '14px 16px',
    backgroundColor: '#fafafa',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s ease',
    cursor: 'default'
  },
  leaderboardTable: {
    background: '#ffffff',
    borderRadius: 8,
    padding: 24,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    border: '1px solid #e5e7eb',
    fontFamily: '"Times New Roman", Times, serif'
  },
  leaderboardTableContainer: {
    overflowX: 'auto',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
  },
  leaderboardTableEl: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    fontFamily: '"Times New Roman", Times, serif'
  },
  tableHeaderRow: {
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb'
  },
  leaderboardTableHeader: {
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#000000',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  leaderboardTableRow: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'all 0.15s ease',
    cursor: 'pointer'
  },
  tableCell: {
    padding: '16px',
    color: '#000000',
    textAlign: 'left',
    fontSize: 14,
    fontWeight: 500
  },
  weeklyGraphContainer: {
    background: '#ffffff',
    borderRadius: 8,
    padding: 24,
    marginTop: 24,
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    fontFamily: '"Times New Roman", Times, serif'
  },
  graphDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 500
  },
  barChartContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 280,
    padding: '20px 16px',
    background: '#fafafa',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    gap: 12
  },
  barWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    transition: 'transform 0.2s ease'
  },
  bar: {
    width: '100%',
    maxWidth: 60,
    borderRadius: '4px 4px 0 0',
    transition: 'all 0.2s ease',
    position: 'relative',
    minHeight: 16,
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    cursor: 'pointer'
  },
  barLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#000000',
    marginBottom: 6
  },
  barDateLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: 500
  }
};

export default styles;
