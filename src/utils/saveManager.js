export function getSaveData() {
    const data = localStorage.getItem('mathKartSave');
    return data ? JSON.parse(data) : {
        coins: 0,
        unlockedCourses: ['forest'],
        unlockedColors: ['red'],
        currentColor: 'red',
        speedUpgrades: 0,
        handlingUpgrades: 0,
        difficulty: 1
    };
}

export function updateSaveData(newData) {
    localStorage.setItem('mathKartSave', JSON.stringify(newData));
}

export function resetSaveData() {
    localStorage.removeItem('mathKartSave');
}
