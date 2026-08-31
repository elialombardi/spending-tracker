export function buildCategoryMessage(category, ruleMode, formContext) {
    if (ruleMode === 'always-review') {
        return formContext === 'edit'
            ? `Updated to “${category}”. Matching descriptions will stay in review for future transactions.`
            : `Saved “${category}”. Matching descriptions will stay in review for future transactions.`
    }

    if (ruleMode === 'auto-apply') {
        return formContext === 'edit'
            ? `Updated to “${category}”. Future matching descriptions can be auto-categorized.`
            : `Saved “${category}”. Future matching descriptions can be auto-categorized.`
    }

    return formContext === 'edit'
        ? `Updated to “${category}” for just this transaction.`
        : `Saved “${category}” for just this transaction.`
}

export function buildCategoryMappingMessage(category, behavior, merchantKey) {
    if (behavior === 'always-review') {
        return `Updated the mapping for ${merchantKey}. Future payments will stay in review.`
    }

    return `Updated the mapping for ${merchantKey} to “${category}”.`
}

export function buildCycleIncomeCategoriesMessage(categories) {
    if (categories.length === 0) {
        return 'Every income transaction can define a cycle again.'
    }

    if (categories.length === 1) {
        return `Cycle starts will use the “${categories[0]}” income category.`
    }

    return `Cycle starts will use ${categories.length} income categories.`
}