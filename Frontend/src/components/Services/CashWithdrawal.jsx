import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Clock, Calendar, MapPin, Building2, CreditCard } from 'lucide-react';
import DashboardLayout from '../Dashboard/DashboardLayout';
import OtpVerificationPopup from '../Common/OtpVerificationPopup';
import SuccessPage from '../Common/SuccessPage';
import { useUser } from '../../hooks/useUser';
import { useServiceRequest } from '../../hooks/useServiceRequest';
import { linkedBankAccounts, standardTimeSlots } from '../../data/bankData';
import { motion } from 'framer-motion';
import VoiceAssistant from '../Common/VoiceAssistant';
import { speak, parseDate, findBestMatch, parseTimeSlot } from '../../utils/voiceUtils';
import { useServiceTranslation } from '../../context/ServiceTranslationContext';
import Toast from '../Admin/Toast';

const CashWithdrawal = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { createServiceRequest } = useServiceRequest();
  const [formData, setFormData] = useState({
    bankAccount: '',
    ifscCode: '',
    accountNo: '',
    withdrawalAddress: '',
    date: '',
    timeSlot: '',
    amount: '',
    pan: '',
    serviceType: 'withdrawal' // Categorizing the service
  });

  // Replace linkedAccounts with standardized data
  const bankAccounts = linkedBankAccounts;

  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const t = useServiceTranslation();
  // Add toast state
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [availableTimeSlots, setAvailableTimeSlots] = useState(standardTimeSlots);

  // Generate minimum date string (today)
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Update available time slots based on selected date
  useEffect(() => {
    if (formData.date === getTodayString()) {
      const currentHour = new Date().getHours();
      const currentMinutes = new Date().getMinutes();
      
      const filteredSlots = standardTimeSlots.filter(slot => {
        const [time, period] = slot.split(' ');
        let [hours, minutes] = time.split(':').map(num => parseInt(num, 10));
        
        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
        
        // Add buffer of 1 hour
        return hours > currentHour + 1 || (hours === currentHour + 1 && minutes >= currentMinutes);
      });
      
      setAvailableTimeSlots(filteredSlots);
      
      // Clear selected time slot if it's no longer available
      if (formData.timeSlot && !filteredSlots.includes(formData.timeSlot)) {
        setFormData(prev => ({ ...prev, timeSlot: '' }));
        if (formData.timeSlot) {
          showToast('Selected time slot is no longer available today. Please choose a different time.', 'warning');
        }
      }
    } else {
      setAvailableTimeSlots(standardTimeSlots);
    }
  }, [formData.date]);

  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 5000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'bankAccount') {
      const selectedAccount = bankAccounts.find(acc => acc.id === value);
      setFormData({ 
        ...formData, 
        bankAccount: value,
        ifscCode: selectedAccount ? selectedAccount.ifsc : '',
        bank: selectedAccount ? selectedAccount.fullName : ''
      });
    } else if (name === 'amount') {
      const numValue = parseInt(value, 10);
      if (numValue > 25000) {
        showToast('Amount cannot exceed ₹25,000', 'warning');
        return;
      }
      setFormData({ ...formData, [name]: value });
    } else if (name === 'date') {
      const selectedDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        showToast('Cannot select a past date', 'error');
        return;
      }
      
      setFormData({ ...formData, [name]: value });
    } else if (name === 'timeSlot') {
      // Time slot validation is handled by the filtered options in the select
      setFormData({ ...formData, [name]: value });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Final validation before submission
    const amount = parseInt(formData.amount, 10);
    if (amount > 25000) {
      showToast('Amount cannot exceed ₹25,000', 'error');
      return;
    }
    
    if (!formData.date || !formData.timeSlot) {
      showToast('Please select a valid date and time', 'error');
      return;
    }
    
    setShowOtpPopup(true);
  };

  const handleOtpVerification = async () => {
    try {
      if (!user?.phone) {
        throw new Error('User phone number not found');
      }

      const requestData = {
        phone: user.phone,
        formData: {
          serviceType: 'CASH_WITHDRAWAL',
          bankAccount: formData.bankAccount,
          date: formData.date,
          timeSlot: formData.timeSlot,
          address: formData.withdrawalAddress, // Map to address
          amount: formData.amount,
          ifscCode: formData.ifscCode,
          description: `Cash withdrawal request for amount: ${formData.amount}`,
          // Additional contact info
          contactNo: user.phone,
          userPhone: user.phone
        }
      };

      await createServiceRequest('CASH_WITHDRAWAL', requestData);
      setShowOtpPopup(false);
      setShowSuccess(true);
    } catch (error) {
      console.error('Error creating service request:', error);
      alert(error.message || 'Failed to create service request');
    }
  };

  const calculateProgress = () => {
    const fields = {
      bankDetails: ['bankAccount', 'ifscCode'],
      delivery: ['withdrawalAddress', 'date', 'timeSlot'],
      amount: ['amount']
    };

    const progress = {
      bankDetails: fields.bankDetails.every(field => formData[field]),
      delivery: fields.delivery.every(field => formData[field]),
      amount: fields.amount.every(field => formData[field])
    };

    return progress;
  };

  const handleVoiceInput = async (voiceData) => {
    const field = Object.keys(voiceData)[0];
    let value = voiceData[field].toLowerCase();

    if (['confirm', 'send', 'submit'].includes(value)) {
      if (calculateProgress().bankDetails && 
          calculateProgress().delivery && 
          calculateProgress().amount) {
        await speak("Submitting your withdrawal request");
        handleSubmit({ preventDefault: () => {} });
        return;
      } else {
        await speak("Please fill all required fields before submitting");
        return;
      }
    }

    let processedValue;
    let feedbackMessage;

    switch (field) {
      case 'bankAccount':
        const bankOptions = bankAccounts.map(acc => ({
          value: acc.id,
          label: acc.bank,
          searchTerms: [
            acc.bank.toLowerCase(),
            acc.accountNo,
            `${acc.bank.toLowerCase()} account`,
            acc.accountNo.slice(-4)
          ]
        }));
        
        const matchedBank = findBestMatch(value, bankOptions);
        if (matchedBank) {
          const selectedAccount = bankAccounts.find(acc => acc.id === matchedBank.value);
          setFormData(prev => ({
            ...prev,
            bankAccount: matchedBank.value,
            ifscCode: selectedAccount.ifsc,
            accountNo: selectedAccount.accountNo
          }));
          feedbackMessage = `Selected ${selectedAccount.bank} account and set IFSC code`;
        } else {
          feedbackMessage = "Sorry, I couldn't find that bank account. Please try again.";
        }
        break;

      case 'withdrawalAddress':
        processedValue = value;
        feedbackMessage = `Set delivery address to ${value}`;
        break;

      case 'date':
        processedValue = parseDate(value);
        if (processedValue) {
          const date = new Date(processedValue);
          feedbackMessage = `Set withdrawal date to ${date.toLocaleDateString()}`;
        } else {
          feedbackMessage = "I couldn't understand the date. Please try again.";
        }
        break;

      case 'timeSlot':
        const matchedTimeSlot = parseTimeSlot(value, standardTimeSlots);
        if (matchedTimeSlot) {
          setFormData(prev => ({
            ...prev,
            timeSlot: matchedTimeSlot
          }));
          feedbackMessage = `Set withdrawal time to ${matchedTimeSlot}`;
        } else {
          feedbackMessage = "I couldn't understand the time. Please say something like '9 AM', '2 PM', or 'morning'";
        }
        break;

      case 'amount':
        const amountStr = value.replace(/[^0-9]/g, '');
        if (amountStr) {
          processedValue = amountStr;
          feedbackMessage = `Set withdrawal amount to ${processedValue} rupees`;
        } else {
          feedbackMessage = "I couldn't understand the amount. Please say a number.";
        }
        break;

      default:
        processedValue = value;
        feedbackMessage = `Set ${field} to ${value}`;
    }

    if (processedValue) {
      setFormData(prev => ({
        ...prev,
        [field]: processedValue
      }));
    }

    await speak(feedbackMessage);
  };

  const handleFieldFocus = (fieldName) => {
    setActiveField(fieldName);
  };

  return (
    <DashboardLayout>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 sm:p-6 md:p-2 h-[calc(95vh-90px)] overflow-y-auto bg-gray-50"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg border"
          >
            <div className="flex items-center justify-between gap-4 p-4 border-b">
              <h2 className="text-lg font-semibold">{t.cashWithdrawal}</h2>
              <VoiceAssistant 
                onVoiceInput={handleVoiceInput}
                activeField={activeField}
                feedbackEnabled={true}
                size="md"
                serviceType="CASH_WITHDRAWAL"
              />
            </div>

            <div className="grid grid-cols-3 border-b">
              {[
                { key: 'bankDetails', label: t.bankDetails, icon: Building2 },
                { key: 'delivery', label: t.address, icon: MapPin },
                { key: 'amount', label: t.withdrawalAmount, icon: DollarSign }
              ].map((step, index) => (
                <motion.div
                  key={step.key}
                  initial={{ backgroundColor: 'rgba(255, 255, 255, 0)' }}
                  animate={{ 
                    backgroundColor: calculateProgress()[step.key] 
                      ? 'rgb(239, 246, 255)' 
                      : 'rgba(255, 255, 255, 0)'
                  }}
                  className={`p-3 sm:p-4 md:p-6 ${index !== 2 ? 'border-r' : ''}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                    <motion.div
                      initial={{ backgroundColor: 'rgb(229, 231, 235)' }}
                      animate={{
                        backgroundColor: calculateProgress()[step.key] 
                          ? 'rgb(59, 130, 246)' 
                          : 'rgb(229, 231, 235)',
                      }}
                      className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center"
                    >
                      <step.icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                    </motion.div>
                    <div>
                      <p className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {step.label}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                        {calculateProgress()[step.key] ? t.completed : t.pending}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.form 
              onSubmit={handleSubmit}
              className="p-4 sm:p-6 md:p-8"
              layout
            >
              <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-6">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-sm sm:text-base md:text-lg font-medium text-gray-700 mb-1.5 sm:mb-2">
                      {t.selectBank}
                    </label>
                    <select
                      name="bankAccount"
                      className="w-full p-3 sm:p-4 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus('bankAccount')}
                      value={formData.bankAccount}
                      required
                    >
                      <option value="">{t.selectBank}</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bank} - {acc.accountNo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm sm:text-base md:text-lg font-medium text-gray-700 mb-1.5 sm:mb-2">
                      {t.ifscCode}
                    </label>
                    <input
                      type="text"
                      name="ifscCode"
                      value={formData.ifscCode}
                      className="w-full p-3 sm:p-4 text-sm sm:text-base border rounded-lg bg-gray-50"
                      readOnly
                    />
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-sm sm:text-base md:text-lg font-medium text-gray-700 mb-1.5 sm:mb-2">
                      {t.withdrawalAddress}
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        name="withdrawalAddress"
                        value={formData.withdrawalAddress}
                        placeholder={t.enterAddress}
                        className="w-full pl-10 p-3 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500"
                        onChange={handleInputChange}
                        onFocus={() => handleFieldFocus('withdrawalAddress')}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm sm:text-base md:text-lg font-medium text-gray-700 mb-1.5 sm:mb-2">
                        {t.date}
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="date"
                          name="date"
                          value={formData.date}
                          min={getTodayString()}
                          className="w-full pl-10 p-3 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500"
                          onChange={handleInputChange}
                          onFocus={() => handleFieldFocus('date')}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm sm:text-base md:text-lg font-medium text-gray-700 mb-1.5 sm:mb-2">
                        {t.timeSlot}
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <select
                          name="timeSlot"
                          value={formData.timeSlot}
                          className="w-full pl-10 p-3 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                          onChange={handleInputChange}
                          onFocus={() => handleFieldFocus('timeSlot')}
                          required
                        >
                          <option value="">{t.selectTime}</option>
                          {availableTimeSlots.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm sm:text-base md:text-lg font-medium text-gray-700 ">
                    {t.withdrawalAmount} <span className="text-gray-500 text-sm">(Max ₹25,000)</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      placeholder={t.enterAmount}
                      className="w-full pl-10 p-3 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500"
                      onChange={handleInputChange}
                      max="25000"
                      onFocus={() => handleFieldFocus('amount')}
                      required
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="md:col-span-2 bg-blue-600 text-white p-4 sm:p-5 rounded-lg sm:rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg md:text-xl font-medium"
                >
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                  {t.scheduleWithdrawal}
                </motion.button>
              </div>
            </motion.form>
          </motion.div>
        </div>

        {showOtpPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <OtpVerificationPopup
              phoneNumber={user?.phone}
              onVerify={handleOtpVerification}
              onClose={() => setShowOtpPopup(false)}
            />
          </motion.div>
        )}

        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <SuccessPage 
              message={t.withdrawalSuccess}
            />
          </motion.div>
        )}

        {toast.show && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast({ ...toast, show: false })} 
          />
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default CashWithdrawal;
