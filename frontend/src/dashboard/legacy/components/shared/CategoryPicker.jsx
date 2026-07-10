import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

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

export default function CategoryPicker({ categories = [], disabled, name, placeholder, value = '', onChange }) {
    const optionNames = categories.map((c) => c.name)

    return (
        <div className={`category-picker${disabled ? ' is-disabled' : ''}`}>
            <Autocomplete
                freeSolo
                disableClearable
                disabled={disabled}
                options={optionNames}
                value={value || ''}
                onChange={(event, newValue) => {
                    if (newValue == null) {
                        onChange('')
                    } else {
                        onChange(newValue)
                    }
                }}
                onInputChange={(event, newInputValue) => {
                    onChange(newInputValue)
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        name={name}
                        placeholder={placeholder}
                        variant="standard"
                    />
                )}
                renderOption={(props, option) => {
                    const cat = categories.find((c) => c.name === option)
                    const meta = cat ? buildCategoryMeta(cat) : ''

                    return (
                        <li {...props} key={option} className="category-picker-option">
                            <span className="category-picker-option-copy">
                                <span className="category-picker-option-title">{option}</span>
                            </span>
                        </li>
                    )
                }}
            />
        </div>
    )
}