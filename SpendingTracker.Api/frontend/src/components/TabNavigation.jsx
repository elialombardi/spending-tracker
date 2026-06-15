import { DASHBOARD_TABS } from '../lib/constants'

export default function TabNavigation({ activeTab, onTabChange, reviewCount }) {
    return (
        <nav className="shell tab-shell" aria-label="Dashboard sections">
            <div className="panel panel-tabs tab-strip" role="tablist" aria-label="Dashboard tabs">
                {DASHBOARD_TABS.map((tab) => {
                    const isActive = tab.id === activeTab

                    return (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            className={`tab-button${isActive ? ' is-active' : ''}`}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`page-${tab.id}`}
                            onClick={() => onTabChange(tab.id)}
                        >
                            <span className="tab-button-title">{tab.title}</span>
                            <span className="tab-button-note">{tab.note}</span>
                            {tab.id === 'review' && reviewCount > 0 ? (
                                <span className="tab-count">{reviewCount}</span>
                            ) : null}
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}