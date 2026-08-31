

export function sumCosts(tasks) {
    return tasks.reduce((total, task) => total + Number(task.cost || 0), 0);
}

export function compareByDateAscending(left, right) {
    return String(left.date || '').localeCompare(String(right.date || '')) || left.id - right.id;
}

export function compareByDateDescending(left, right) {
    return String(right.date || '').localeCompare(String(left.date || '')) || right.id - left.id;
}

export function groupNotSentByMonth(tasks) {
    const groups = [];
    let currentGroup = null;

    [...tasks].sort(compareByDateAscending).forEach((task) => {
        const key = monthKey(task.date);
        if (!currentGroup || currentGroup.key !== key) {
            currentGroup = { key, tasks: [] };
            groups.push(currentGroup);
        }
        currentGroup.tasks.push(task);
    });

    return groups;
}

export function monthKey(dateValue) {
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return 'Unknown month';
    }
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(parsed);
}

export function groupNotSentByProject(tasks) {
    const grouped = new Map();
    [...tasks].sort(compareByDateAscending).forEach((task) => {
        const key = task.projectName || 'Unknown project';
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(task);
    });

    return [...grouped.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([projectName, projectTasks]) => ({
            projectName,
            totalCost: sumCosts(projectTasks),
            tasks: projectTasks,
        }));
}
