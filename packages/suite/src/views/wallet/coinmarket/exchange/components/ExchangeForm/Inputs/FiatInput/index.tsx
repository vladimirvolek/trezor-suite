import { Input } from '@trezor/components';
import React from 'react';
import styled from 'styled-components';
import { InputError } from '@wallet-components';
import { isDecimalsValid } from '@wallet-utils/validation';
import { useCoinmarketExchangeFormContext } from '@wallet-hooks/useCoinmarketExchangeForm';
import { Translation } from '@suite-components';
import FiatSelect from './FiatSelect';
import BigNumber from 'bignumber.js';
import { MAX_LENGTH } from '@suite-constants/inputs';
import { toFiatCurrency } from '@wallet-utils/fiatConverterUtils';
import { useForm } from 'react-hook-form';
import { FormState } from '@wallet-types/coinmarketExchangeForm';

const StyledInput = styled(Input)`
    border-left: 0;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
`;

const FiatInput = () => {
    const {
        register,
        network,
        clearErrors,
        errors,
        trigger,
        updateReceiveCryptoValue,
        setMax,
        setValue,
        quotesRequest,
        fiatRates,
    } = useCoinmarketExchangeFormContext();
    const fiatInput = 'fiatInput';

    const methods = useForm<FormState>({ mode: 'onChange' });
    const { getValues } = methods;
    const currency = getValues('fiatSelect');

    console.log(`currency: ${currency}`);

    return (
        <StyledInput
            onFocus={() => {
                trigger([fiatInput]);
            }}
            onChange={event => {
                setMax(false);
                if (errors[fiatInput]) {
                    setValue('receiveCryptoInput', '');
                } else {
                    updateReceiveCryptoValue(event.target.value, network.decimals);
                    clearErrors(fiatInput);
                }
            }}
            defaultValue={
                quotesRequest && currency && currency.value
                    ? toFiatCurrency(
                          quotesRequest.sendStringAmount,
                          currency.value,
                          fiatRates?.current?.rates,
                      ) || ''
                    : ''
            }
            state={errors[fiatInput] ? 'error' : undefined}
            name={fiatInput}
            noTopLabel
            maxLength={MAX_LENGTH.AMOUNT}
            innerRef={register({
                validate: (value: any) => {
                    if (value) {
                        const amountBig = new BigNumber(value);
                        if (amountBig.isNaN()) {
                            return 'AMOUNT_IS_NOT_NUMBER';
                        }

                        if (!isDecimalsValid(value, 2)) {
                            return (
                                <Translation
                                    id="AMOUNT_IS_NOT_IN_RANGE_DECIMALS"
                                    values={{ decimals: 2 }}
                                />
                            );
                        }

                        if (amountBig.lte(0)) {
                            return 'AMOUNT_IS_TOO_LOW';
                        }
                    }
                },
            })}
            bottomText={<InputError error={errors[fiatInput]} />}
            innerAddon={<FiatSelect />}
        />
    );
};

export default FiatInput;
