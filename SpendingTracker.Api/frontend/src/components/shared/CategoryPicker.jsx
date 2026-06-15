import { useEffect, useRef, useState } from 'react'

function buildCategoryMeta(category) {
    const parts = []

    if (category.transactions > 0) {
        parts.push(`${category.transactions} tx`)
    }

    if (category.rules > 0) {
        parts.push(`${category.rules} rule${category.rules === 1 ? '' : 's'}`)
    }

    return parts.join(' • ')
}

function matchesCategory(categoryName, query) {
    if (!query) {
        return true
    }

    return categoryName.toLowerCase().includes(query)
}

export default function CategoryPicker({ categories, disabled, name, placeholder, value, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)
    const normalizedValue = value.trim().toLowerCase()
    const filteredCategories = categories
        .filter((category) => matchesCategory(category.name, normalizedValue))
        .slice(0, 8)
    const hasExactMatch = categories.some((category) => category.name.toLowerCase() === normalizedValue)
    const canCreateCategory = normalizedValue.length > 0 && !hasExactMatch

    useEffect(() => {
        if (!isOpen) {
            return undefined
        }

        function handlePointerDown(event) {
            if (!containerRef.current?.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [isOpen])

    function selectCategory(categoryName) {
        onChange(categoryName)
        setIsOpen(false)
    }

    function handleInputChange(event) {
        onChange(event.target.value)
        setIsOpen(true)
    }

    function handleInputKeyDown(event) {
        if (event.key === 'Escape') {
            setIsOpen(false)
            return
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsOpen(true)
        }
    }

    return (
        <div
            ref={containerRef}
            className={`category-picker${isOpen ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
        >
            <div className="category-picker-field">
                <input
                    className="category-picker-input"
                    type="text"
                    name={name}
                    placeholder={placeholder}
                    value={value}
                    autoComplete="off"
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleInputKeyDown}
                    disabled={disabled}
                />

                <button
                    className="category-picker-toggle"
                    type="button"
                    aria-label={isOpen ? 'Hide categories' : 'Show categories'}
                    onClick={() => setIsOpen((currentValue) => !currentValue)}
                    disabled={disabled}
                >
                    <span className={`category-picker-chevron${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                        ▾
                    </span>
                </button>
            </div>

            {isOpen && !disabled ? (
                <div className="category-picker-panel">
                    {filteredCategories.map((category) => {
                        const meta = buildCategoryMeta(category)
                        const isSelected = category.name === value.trim()

                        return (
                            <button
                                key={category.name}
                                className={`category-picker-option${isSelected ? ' is-selected' : ''}`}
                                type="button"
                                onClick={() => selectCategory(category.name)}
                            >
                                <span className="category-picker-option-copy">
                                    <span className="category-picker-option-title">{category.name}</span>
                                    {meta ? <span className="category-picker-option-meta">{meta}</span> : null}
                                </span>
                                {isSelected ? <span className="category-picker-option-state">Selected</span> : null}
                            </button>
                        )
                    })}

                    {canCreateCategory ? (
                        <button
                            className="category-picker-option category-picker-option-create"
                            type="button"
                            onClick={() => selectCategory(value.trim())}
                        >
                            <span className="category-picker-option-copy">
                                <span className="category-picker-option-title">Use “{value.trim()}”</span>
                                <span className="category-picker-option-meta">Create a new category name</span>
                            </span>
                            <span className="category-picker-option-state">New</span>
                        </button>
                    ) : null}

                    {filteredCategories.length === 0 && !canCreateCategory ? (
                        <div className="category-picker-empty">
                            No matching categories yet. Keep typing to create one.
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}