// Test script to verify timezone correction and create new properly scheduled draws
import axios from 'axios';

async function testTimezoneFix() {
  try {
    console.log('=== Testing Timezone Fix ===');
    
    // Check current upcoming draws
    console.log('\n1. Current upcoming draws:');
    const upcoming = await axios.get('http://localhost:5000/api/draws/upcoming');
    console.log('Daily draw:', upcoming.data.daily);
    console.log('Weekly draw:', upcoming.data.weekly);
    
    // Convert to CAT times for display
    const dailyDateUTC = new Date(upcoming.data.daily.drawDate);
    const weeklyDateUTC = new Date(upcoming.data.weekly.drawDate);
    
    console.log('\n2. Draw times in UTC and CAT:');
    console.log('Daily draw UTC time:', dailyDateUTC.toISOString());
    console.log('Weekly draw UTC time:', weeklyDateUTC.toISOString());
    console.log('Daily draw CAT time:', dailyDateUTC.toLocaleString('en-US', { timeZone: 'Africa/Harare' }));
    console.log('Weekly draw CAT time:', weeklyDateUTC.toLocaleString('en-US', { timeZone: 'Africa/Harare' }));
    
    // Extract CAT hours from the formatted string
    const dailyCATString = dailyDateUTC.toLocaleString('en-US', { timeZone: 'Africa/Harare', hour: '2-digit', hour12: false });
    const weeklyCATString = weeklyDateUTC.toLocaleString('en-US', { timeZone: 'Africa/Harare', hour: '2-digit', hour12: false });
    
    const dailyHourCAT = parseInt(dailyCATString);
    const weeklyHourCAT = parseInt(weeklyCATString);
    
    console.log('\n3. Verification:');
    console.log('Daily draw hour (should be 18 for 6:00 PM CAT):', dailyHourCAT);
    console.log('Weekly draw hour (should be 20 for 8:00 PM CAT):', weeklyHourCAT);
    
    if (dailyHourCAT === 18 && weeklyHourCAT === 20) {
      console.log('✅ Timezone correction is working correctly!');
      console.log('✅ Daily draws scheduled for 6:00 PM CAT');
      console.log('✅ Weekly draws scheduled for 8:00 PM CAT');
    } else {
      console.log('❌ Timezone correction needs adjustment');
      console.log('Expected: Daily=18, Weekly=20 (CAT hours)');
      console.log('Actual: Daily=' + dailyHourCAT + ', Weekly=' + weeklyHourCAT);
    }
    
  } catch (error) {
    console.error('Error testing timezone fix:', error.message);
  }
}

testTimezoneFix();